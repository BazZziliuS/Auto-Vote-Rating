// noinspection ES6MissingAwait

const state = self.serviceWorker.state

importScripts('libs/idb.umd.js')
importScripts('src/core/projects.js')
// Импорт утилит базы данных (должны быть ДО main.js)
importScripts('src/utils/database/db-migrations/migration-v0.js')
importScripts('src/utils/database/db-migrations/migration-v1-v12.js')
importScripts('src/utils/database/db-migrations/migration-v13.js')
importScripts('src/utils/database/db-migrations/migration-v14.js')
importScripts('src/utils/database/db-migrations/index.js')
importScripts('src/utils/database/db-init.js')
importScripts('src/core/main.js')
importScripts('src/utils/index.js')

// TODO отложенный importScripts пока не работают, подробнее https://bugs.chromium.org/p/chromium/issues/detail?id=1198822
self.addEventListener('install', () => {
    importScripts('libs/linkedom.js')
    importScripts('src/scripts/silentvote/mcserver-list.eu_silentvote.js', 'src/scripts/silentvote/misterlauncher.org_silentvote.js', 'src/scripts/silentvote/serverpact.com_silentvote.js', 'src/scripts/silentvote/genshindrop.com_silentvote.js', 'src/scripts/silentvote/bloodrust.com_silentvote.js')
})

//ID группы вкладок в которой сейчас открыты вкладки расширения
let groupId
//Если этот браузер не поддерживает группировку вкладок
let notSupportedGroupTabs = false

//Нужно ли сейчас делать проверку голосования, false может быть только лишь тогда когда предыдущая проверка ещё не завершилась
let check = true
let doubleCheck = false

let silentResponseBody = {}

//Инициализация настроек расширения
// noinspection JSIgnoredPromiseFromCall
const initializeFunc = initializeConfig(true)
initializeFunc.finally(() => initializeFunc.done = true)

/**
 * Проверяет необходимость голосования для всех проектов
 * Сверяет текущее время с временем из конфигурации каждого проекта
 * @async
 * @returns {Promise<void>}
 */
async function checkVote() {

    await initializeFunc

    // Проверка браузера Opera
    if (shouldSkipForOpera(settings)) {
        return
    }

    // Проверка восстановления интернет-соединения
    const restorationCheck = await checkInternetRestoration(settings, db, onLine)
    if (restorationCheck.shouldReturn) return
    if (restorationCheck.newOnLineStatus !== null) {
        onLine = restorationCheck.newOnLineStatus
    }

    if (check) {
        check = false
    } else {
        doubleCheck = true
        return
    }

    const transaction = db.transaction('projects')
    let cursor = await transaction.objectStore('projects').openCursor()
    while (cursor) {
        const project = cursor.value
        if (!project.time || project.time < Date.now()) {
            await checkOpen(project, transaction)
        }
        // noinspection JSVoidFunctionReturnValueUsed
        cursor = await cursor.continue()
    }

    check = true
    if (doubleCheck) {
        doubleCheck = false
        checkVote()
    } else {
        // Голосование завершилось и более не планируется
        if (!openedProjects.size) {
            promises = []
            updateListeners(false)
        }
    }
}

//Триггер на голосование когда подходит время голосования
chrome.alarms.onAlarm.addListener(function (alarm) {
    if (settings?.debug) console.log('chrome.alarms.onAlarm', JSON.stringify(alarm))
    // noinspection JSIgnoredPromiseFromCall
    checkVote()
})

// TODO костыльное решение бага https://bugs.chromium.org/p/chromium/issues/detail?id=471524
chrome.idle.onStateChanged.addListener(async function (newState) {
    if (newState === 'active') {
        // noinspection JSIgnoredPromiseFromCall
        checkVote()
    }
})

/**
 * Перезагружает все будильники для проектов
 * Очищает старые алармы и создает новые на основе текущих данных проектов
 * @async
 * @returns {Promise<void>}
 */
async function reloadAllAlarms() {
    await chrome.alarms.clearAll()
    let cursor = await db.transaction('projects').store.openCursor()
    const times = []
    while (cursor) {
        const project = cursor.value
        if (project.time != null && project.time > Date.now() && times.indexOf(project.time) === -1) {
            await createSafeAlarm(String(cursor.key), project.time, project)
            times.push(project.time)
        }
        // noinspection JSVoidFunctionReturnValueUsed
        cursor = await cursor.continue()
    }
}

let promises = []

/**
 * Проверяет возможность запуска голосования для проекта
 * Валидирует состояние интернета, открытые вкладки и запускает процесс голосования
 * @async
 * @param {Object} project - Объект проекта для голосования
 * @param {IDBTransaction} transaction - Транзакция базы данных
 * @returns {Promise<void>}
 */
async function checkOpen(project, transaction) {
    // Проверка интернет-соединения
    const connectionCheck = await checkInternetConnection(project, settings, db, onLine)
    if (connectionCheck.shouldReturn) return
    if (connectionCheck.newOnLineStatus !== null) {
        onLine = connectionCheck.newOnLineStatus
    }

    // Очистка истекших записей из очереди
    const removed = cleanupExpiredQueue(openedProjects)
    if (removed.length > 0) {
        db.put('other', openedProjects, 'openedProjects')
    }

    // Проверка и обработка конфликтов с уже открытыми проектами
    const shouldStop = await handleProjectConflicts(project, openedProjects, transaction, settings, db)
    if (shouldStop) return

    // Очистка временных полей и создание объекта opened
    cleanupProjectTempFields(project)
    const opened = createOpenedProject(project, settings)

    // Голосование запускается впервые
    if (!openedProjects.size) {
        updateListeners(true)
    }

    openedProjects.set('start_' + project.key, opened)
    db.put('other', openedProjects, 'openedProjects')

    if (settings.debug) console.log(getProjectPrefix(project, true), 'пред запуск')

    if (project.rating === 'monitoringminecraft.ru') {
        promises.push(clearMonitoringMinecraftCookies(project, settings.debug))
    }

    // noinspection JSIgnoredPromiseFromCall
    newWindow(project, opened)
}

let promiseGroup
let promiseWindow

//Открывает вкладку для голосования или начинает выполнять fetch запросы
async function newWindow(project, opened) {
    //Ожидаем очистку куки
    let result = await Promise.all(promises)
    while (result.length < promises.length) {
        result = await Promise.all(promises)
    }

    console.log(getProjectPrefix(project, true), chrome.i18n.getMessage('startedAutoVote'))
    sendNotification(getProjectPrefix(project, false), chrome.i18n.getMessage('startedAutoVote'), 'start', 'openProject_' + project.key)

    // Инициализация статистики перед голосованием
    todayStats = initializeStatsBeforeVote(project, generalStats, todayStats)

    await db.put('other', generalStats, 'generalStats')
    await db.put('other', todayStats, 'todayStats')
    await updateValue('projects', project)

    // Создание nextAttempt alarm
    await createNextAttemptAlarmIfNeeded(project, opened, settings)

    // Определяем режим голосования (silent или tab)
    if (shouldUseSilentVote(project, allProjects)) {
        openedProjects.set('background_' + project.key, opened)
        openedProjects.delete('start_' + project.key)
        db.put('other', openedProjects, 'openedProjects')
        silentVote(project)
    } else {
        let result = await promiseWindow
        if (result === false) return
        promiseWindow = checkWindow(project)
        result = await promiseWindow
        if (result === false) return

        const url = allProjects[project.rating].voteURL(project)

        let tab = await tryOpenTab({
            url,
            active: settings.disabledFocusedTab || Boolean(allProjects[project.rating].focusedTab?.(project))
        }, project, 0)
        if (tab == null) return
        openedProjects.set(tab.id, opened)
        openedProjects.delete('start_' + project.key)
        db.put('other', openedProjects, 'openedProjects')

        // Группировка вкладки
        if (!notSupportedGroupTabs) {
            const result = await handleTabGrouping(tab, groupId, promiseGroup, project, chrome.i18n.getMessage)
            groupId = result.groupId
            promiseGroup = result.promiseGroup
            notSupportedGroupTabs = result.notSupported
        }
    }
}

// Функции checkWindow и groupTabs перенесены в utils/tab-manager.js
// checkWindow → checkWindow
// groupTabs → groupTabIntoAutoVoteGroup

/**
 * Выполняет silent vote для проекта
 * Обертка над модульной функцией для совместимости
 */
async function silentVote(project) {
    await executeSilentVote(project, silentResponseBody)
}

/**
 * Проверяет ответ на ошибки
 * Обертка над модульной функцией для совместимости
 */
async function checkResponseError(project, response, url, bypassCodes, vk) {
    return await validateSilentVoteResponse(project, response, url, bypassCodes, vk, silentResponseBody)
}

const webNavigationOnCommittedListener = function (details) {
    if (!initializeFunc.done) {
        (async () => {
            await initializeFunc
            let opened = openedProjects.get(details.tabId)
            if (!opened) return
            const project = await db.get('projects', opened.key)
            let message = chrome.i18n.getMessage('notReadyInject')
            if (project.error === message) return
            console.warn(getProjectPrefix(project, true), message)
            sendNotification(getProjectPrefix(project, false), message, 'warn', 'openProject_' + project.key)
            project.error = message
            updateValue('projects', project)
        })()
        return
    }

    let opened = openedProjects.get(details.tabId)
    if (!opened) return
    if (details.url.startsWith('blob:')) return

    // Проверка URL авторизации
    if (details.frameId === 0 && isAuthUrl(details.url)) {
        return
    }

    // Определение скриптов для инъекции
    const {filesIsolated, filesMain} = determineScriptsToInject(details, getDomainWithoutSubdomain, isCaptchaUrlForCommitted, allProjects)

    // Выполнение инъекции
    executeScriptInjection(details.tabId, details.frameId, filesIsolated, filesMain, catchTabError, opened, db, settings.debug, details.url)
}

//Слушатель на обновление вкладок, если вкладка полностью загрузилась, загружает туда скрипт который сам нажимает кнопку проголосовать
const webNavigationOnCompletedListener = async function (details) {

    await initializeFunc
    let opened = openedProjects.get(details.tabId)
    if (!opened) return

    if (details.frameId === 0) {
        // Проверка URL авторизации
        if (isAuthUrl(details.url)) {
            return
        }

        const project = await db.get('projects', opened.key)

        // Проверка лимита попыток инъекции
        if (opened.countInject >= LIMITS.MAX_INJECT_ATTEMPTS) {
            endVote({tooManyVoteAttempts: true}, {tab: {id: details.tabId}, url: details.url}, opened)
            return
        }

        // Инъекция скриптов голосования
        try {
            await injectVoteScripts(details.tabId, project, settings, allProjects, settings.debug, details.url)

            if (openedProjects.has(details.tabId)) {
                opened.countInject++
                db.put('other', openedProjects, 'openedProjects')
            }
        } catch (error) {
            catchTabError(error, project, db)
        }
    } else if (details.frameId !== 0 && isCaptchaUrl(details.url)) {
        // Инъекция скриптов капчи
        const project = await db.get('projects', opened.key)

        try {
            await injectCaptchaScripts(details.tabId, details.frameId, project, settings, settings.debug, details.url)
        } catch (error) {
            catchTabError(error, project, db)
        }
    }
}

// Функция catchTabError перенесена в utils/error-handler.js

const tabsOnRemovedListener = async function (tabId) {
    await initializeFunc
    let opened = openedProjects.get(tabId)
    if (!opened) return
    endVote({closedTab: true}, {tab: {id: tabId}}, opened)
}

const webRequestOnCompletedListener = async function (details) {
    await initializeFunc
    let opened = openedProjects.get(details.tabId)
    if (!opened) return

    // Иногда некоторые проекты намеренно выдаёт ошибку в status code, нам ничего не остаётся кроме как игнорировать все ошибки, подробнее https://discord.com/channels/371699266747629568/760393040174120990/1053016256535593022
    if (allProjects[opened.rating].ignoreErrors?.()) return

    if (details.type === 'main_frame' && (details.statusCode < 200 || details.statusCode > 299)) {
        if (details.statusCode === 503 || details.statusCode === 403) { // Если проверка CloudFlare
            opened.countInject--
            db.put('other', openedProjects, 'openedProjects')
        } else {
            const sender = {tab: {id: details.tabId}, url: details.url}
            endVote({errorVote: [String(details.statusCode), details.url]}, sender, opened)
        }
    }
}

const webRequestOnErrorOccurredListener = async function (details) {
    await initializeFunc
    if (openedProjects.has(details.tabId)) {
        if (details.type === 'main_frame' || isCaptchaDomain(details.url)) {
            const opened = openedProjects.get(details.tabId)
            if (isIgnorableNetworkError(details.error)) {
                return
            }
            const sender = {tab: {id: details.tabId}, url: details.url}
            endVote({errorVoteNetwork: [details.error, details.url]}, sender, opened)
        }
    }
}

const webNavigationOnErrorOccurredListener = async function (details) {
    await initializeFunc
    if (openedProjects.has(details.tabId)) {
        if (details.frameId === 0 || isCaptchaDomain(details.url)) {
            const opened = openedProjects.get(details.tabId)
            if (isIgnorableNetworkError(details.error)) {
                return
            }
            const sender = {tab: {id: details.tabId}, url: details.url}
            endVote({errorVoteNetwork: [details.error, details.url]}, sender, opened)
        }
    }
}

/**
 * Управляет регистрацией/разрегистрацией слушателей событий
 * Оптимизирует работу фонового процесса - отключает слушатели когда голосование не активно
 * @param {boolean} enable - true для регистрации, false для разрегистрации слушателей
 */
function updateListeners(enable) {
    updateAllVoteListeners(enable, {
        webNavigationOnErrorOccurred: webNavigationOnErrorOccurredListener,
        webNavigationOnCommitted: webNavigationOnCommittedListener,
        webNavigationOnCompleted: webNavigationOnCompletedListener,
        tabsOnRemoved: tabsOnRemovedListener,
        webRequestOnCompleted: webRequestOnCompletedListener,
        webRequestOnErrorOccurred: webRequestOnErrorOccurredListener
    }, openedProjects, settings)
}

// Так как Service Worker может уснуть прямо во время голосования, мы прям при запуске всё равно регистрируем слушателей
// после инициализации базы данных если обнаруживается что сейчас мы не голосуем и нет необходимости голосовать - мы разрегистрируем слушатели
updateListeners(true)

//Слушатель сообщений и ошибок
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    // noinspection JSIgnoredPromiseFromCall
    onRuntimeMessage(request, sender, sendResponse)
    if (request.projectDeleted || request.projectRestart) {
        return true
    }
})

let fakeIdToId = {};

async function onRuntimeMessage(request, sender, sendResponse) {
    if (request.reloadCaptcha) {
        await handleReloadCaptcha(sender, settings)
        return
    } else if (request.captchaPassed) {
        await handleCaptchaPassed(request, sender)
        if (request.captchaPassed !== 'double') return
    } else if (request.HackTimer) {
        handleHackTimer(request, sender, fakeIdToId)
        return
    }

    await initializeFunc

    if (request === 'checkVote') {
        checkVote()
        return
    } else if (request === 'reloadAllSettings') {
        const result = await handleReloadAllSettings(db, openedProjects, tryCloseTab, reloadAllAlarms, checkVote)
        settings = result.settings
        generalStats = result.generalStats
        todayStats = result.todayStats
        return
    } else if (request === 'reloadSettings') {
        settings = await db.get('other', 'settings')
        return
    } else if (request.projectDeleted) {
        const result = await handleProjectDeleted(request, openedProjects, db)
        sendResponse(result)
        return
    } else if (request.projectRestart) {
        const result = await handleProjectRestart(request, openedProjects, db, settings)
        sendResponse(result)
        return
    }

    if (request.changeProject) {
        updateValue('projects', request.changeProject)
        return
    }

    if (!openedProjects.has(sender.tab.id)) {
        console.warn('A double attempt to complete the vote? chrome.runtime.onMessage', JSON.stringify(request), JSON.stringify(sender))
        return
    }

    let opened = openedProjects.get(sender.tab.id)

    // Обработка ручных действий (капча, авторизация и т.д.)
    if (requiresManualAction(request)) {
        await handleManualActionRequired(request, sender, opened, settings, db)
    } else {
        endVote(request, sender, opened)
    }
}

// Функция triggerTimer перенесена в utils/message-handlers.js
// Функции tryOpenTab, tryCloseTab, tryGroupTabs перенесены в utils/tab-manager.js

//Завершает голосование, если есть ошибка то обрабатывает её
async function endVote(request, sender, project) {
    const timeout = settings.timeout

    // Найти и подготовить opened проект
    const opened = findAndPrepareOpenedProject(openedProjects, project, timeout, db)
    if (!opened) return

    // Получить актуальные данные проекта
    project = await db.get('projects', project.key)

    // Проверить неправильный домен
    checkIncorrectDomain(request, sender, project)

    // Закрыть вкладку при необходимости
    closeTabIfNeeded(request, sender, project, settings)

    // Повторно достаём project так как за время отправки отчёта или использования удалённого кода он мог измениться
    project = await db.get('projects', project.key)

    //Если усё успешно
    let sendMessage
    if (request.successfully || request.later != null) {
        // Вычисляем время следующего голосования
        const time = calculateNextVoteTime(project, request, allProjects)

        // Применяем рандомизацию
        project.time = applyTimeRandomization(project, time)

        delete project.error
        delete project.warn

        if (request.successfully) {
            // Обновляем статистику успеха
            updateSuccessStats(project, generalStats, todayStats)

            // Форматируем и отправляем сообщение
            sendMessage = formatSuccessMessage(request, chrome)
            if (typeof request.successfully === 'string') {
                project.warn = request.successfully
            }
            sendNotification(getProjectPrefix(project, false), sendMessage, 'info', 'openProject_' + project.key)
        } else {
            // Обновляем статистику later
            updateLaterStats(project, generalStats, todayStats)

            // Форматируем и отправляем сообщение
            sendMessage = formatLaterMessage(request, chrome)
            if (typeof request.later === 'string') {
                project.warn = request.later
            }
            sendNotification(getProjectPrefix(project, false), sendMessage, project.warn ? 'warn' : 'info', 'openProject_' + project.key)
        }
        console.log(getProjectPrefix(project, true), sendMessage + ', ' + chrome.i18n.getMessage('timeStamp') + ' ' + project.time)
        //Если ошибка
    } else {
        // Форматируем сообщение об ошибке
        const message = formatErrorMessage(request, chrome)

        // Вычисляем cooldown для retry
        const retryCoolDown = calculateErrorCooldown(request, project, settings)

        // Применяем рандомизацию к cooldown
        const finalCooldown = applyRandomization(retryCoolDown, project)

        // Устанавливаем время следующей попытки
        project.time = Date.now() + finalCooldown
        project.error = message

        // Форматируем финальное сообщение
        sendMessage = message + '. ' + chrome.i18n.getMessage('errorNextVote', (Math.round(finalCooldown / 1000 / 60 * 100) / 100).toString())

        // Логируем и отправляем уведомление
        console.error(getProjectPrefix(project, true), sendMessage + ', ' + chrome.i18n.getMessage('timeStamp') + ' ' + project.time)
        if (shouldNotifyError(request)) {
            sendNotification(getProjectPrefix(project, false), sendMessage, 'error', 'openProject_' + project.key)
        }

        // Обновляем статистику ошибок
        updateErrorStats(project, generalStats, todayStats)
    }

    // Сохраняем статистику и проект
    await saveStatsAndProject(db, generalStats, todayStats, project)

    // Планируем alarm для следующего голосования
    await scheduleProjectAlarm(project)

    // Планируем cleanup очереди и следующую проверку голосования
    scheduleQueueCleanup(project, openedProjects, timeout, db, checkVote)
}


chrome.notifications.onClicked.addListener(async function (notificationId) {
    await handleNotificationClick(notificationId, db, openOptionsPage)
})

async function openOptionsPage() {
    await chrome.runtime.openOptionsPage()
    // Дикий костыль на ожидание загрузки вкладки, мы не можем адекватно передать в настройки нужные данные, поэтому придётся так костылять
    const tab = await chrome.tabs.query({active: true, lastFocusedWindow: true})
    if (!tab.length) return
    if (tab[0].status !== 'complete') {
        for (let i = 0; i < LIMITS.MAX_TAB_LOAD_WAIT_CYCLES; i++) {
            await wait(TIME.TAB_LOAD_CHECK_DELAY)
            const t = await chrome.tabs.get(tab[0].id)
            if (t.status === 'complete') break
        }
    }
}



/**
 * Обновляет значение в хранилище базы данных
 * @async
 * @param {string} objStore - Имя хранилища ('projects', 'other')
 * @param {Object} value - Объект для обновления (должен содержать поле key)
 * @returns {Promise<void>}
 */
async function updateValue(objStore, value) {
    await updateStoreValue(db, objStore, value)
}

chrome.runtime.onInstalled.addListener(async function (details) {
    await initializeFunc
    // Проверка браузера Opera
    if (shouldSkipForOpera(settings)) {
        chrome.runtime.openOptionsPage()
        return
    }
    if (details.reason === 'install') {
        await openOptionsPage()
        chrome.runtime.sendMessage({installed: true})
    } else if (details.reason === 'update') {
        checkVote()
    }
})

/*
Открытый репозиторий:
https://github.com/Serega007RU/Auto-Vote-Rating/
*/