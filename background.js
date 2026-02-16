// noinspection ES6MissingAwait

const state = self.serviceWorker.state

importScripts('libs/idb.umd.js')
importScripts('projects.js')
importScripts('main.js')
importScripts('utils/constants.js')
importScripts('utils/time.js')
importScripts('utils/project.js')
importScripts('utils/retry.js')
importScripts('utils/database-helpers.js')
importScripts('utils/opened-projects-manager.js')
importScripts('utils/alarms.js')
importScripts('utils/vote-time-calculator.js')
importScripts('utils/vote-result-handler.js')
importScripts('utils/stats-updater.js')
importScripts('utils/silent-vote-handler.js')
importScripts('utils/tab-manager.js')
importScripts('utils/message-handlers.js')
importScripts('utils/notifications.js')
importScripts('utils/console-interceptor.js')

// TODO отложенный importScripts пока не работают, подробнее https://bugs.chromium.org/p/chromium/issues/detail?id=1198822
self.addEventListener('install', () => {
    importScripts('libs/linkedom.js')
    importScripts('scripts/mcserver-list.eu_silentvote.js', 'scripts/misterlauncher.org_silentvote.js', 'scripts/serverpact.com_silentvote.js', 'scripts/genshindrop.com_silentvote.js', 'scripts/bloodrust.com_silentvote.js')
})

//Текущие fetch запросы
// noinspection ES6ConvertVarToLetConst
// var fetchProjects = new Map()
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

    // noinspection JSUnresolvedReference
    if (!settings.operaAttention2 && (navigator?.userAgentData?.brands?.[0]?.brand === 'Opera' || (!!self.opr && !!opr.addons) || !!self.opera || navigator.userAgent.indexOf(' OPR/') >= 0)) {
        return
    }

    //Если после попытки голосования не было интернета, проверяется есть ли сейчас интернет и если его нет то не допускает последующую проверку но есои наоборот появился интернет, устаналвивает статус online на true и пропускает код дальше
    if (!settings.disabledCheckInternet && !onLine) {
        if (navigator.onLine) {
            console.log(chrome.i18n.getMessage('internetRestored'))
            onLine = true
            db.put('other', onLine, 'onLine')
        } else {
            // TODO к сожалению в Service Worker отсутствует слушатель на восстановление соединения с интернетом, у нас остаётся только 1 вариант, это попытаться снова запустить checkVote через минуту
            chrome.alarms.create('checkVote', {when: Date.now() + TIME.MIN_ALARM_DELAY})
            return
        }
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
            let when = project.time
            if (when - Date.now() < TIME.MIN_ALARM_DELAY) when = Date.now() + TIME.MIN_ALARM_DELAY
            try {
                chrome.alarms.create(String(cursor.key), {when})
            } catch (error) {
                console.warn(getProjectPrefix(project, true), 'Ошибка при создании chrome.alarms', error.message)
            }
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
    //Если нет интернета, то не голосуем
    if (settings.disabledCheckInternet) {
        // Проверка интернета отключена, пропускаем
    } else if (!navigator.onLine && onLine) {
        // TODO к сожалению в Service Worker отсутствует слушатель на восстановление соединения с интернетом, у нас остаётся только 1 вариант, это попытаться снова запустить checkVote через минуту
        chrome.alarms.create('checkVote', {when: Date.now() + TIME.MIN_ALARM_DELAY})

        sendNotification(getProjectPrefix(project, false), chrome.i18n.getMessage('internetDisconnected'), 'error', 'openProject_' + project.key)
        console.warn(getProjectPrefix(project, true), chrome.i18n.getMessage('internetDisconnected'))
        onLine = false
        db.put('other', onLine, 'onLine')
        return
    } else if (!onLine) {
        return
    }

    // Очистка истекших записей из очереди
    const removed = cleanupExpiredQueue(openedProjects)
    if (removed.length > 0) {
        db.put('other', openedProjects, 'openedProjects')
    }

    // Проверка конфликтов с уже открытыми проектами
    for (let [tab, value] of openedProjects) {
        if (hasConflict(project, value, settings)) {
            if (!canRestart(tab, value, settings)) {
                return
            }

            // Можем перезапустить - закрываем старый проект
            openedProjects.delete(tab)
            db.put('other', openedProjects, 'openedProjects')

            const projectTimeout = await transaction.objectStore('projects').get(value.key)
            if (!value.nextAttempt) {
                console.warn(getProjectPrefix(projectTimeout, true), 'nextAttempt is undefined, maybe it\'s an error')
            }
            console.warn(getProjectPrefix(projectTimeout, true), chrome.i18n.getMessage('timeout'))
            sendNotification(getProjectPrefix(projectTimeout, false), chrome.i18n.getMessage('timeout'), 'warn', 'openProject_' + project.key)

            // noinspection JSIgnoredPromiseFromCall
            if (!settings.disableCloseTabsOnError) tryCloseTab(tab, projectTimeout, 0)
            break
        }
    }

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
        promises.push(clearMonitoringMinecraftCookies())

        async function clearMonitoringMinecraftCookies() {
            let url
            if (project.rating === 'monitoringminecraft.ru') {
                url = '.monitoringminecraft.ru'
            }
            let cookies = await chrome.cookies.getAll({domain: url})
            if (settings.debug) console.log(chrome.i18n.getMessage('deletingCookies', url))
            for (let i = 0; i < cookies.length; i++) {
                if (cookies[i].domain.charAt(0) === '.') cookies[i].domain = cookies[i].domain.substring(1, cookies[i].domain.length)
                await chrome.cookies.remove({
                    url: 'https://' + cookies[i].domain + cookies[i].path,
                    name: cookies[i].name
                })
            }
        }
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

    if (new Date(project.stats.lastAttemptVote).getMonth() < new Date().getMonth() || new Date(project.stats.lastAttemptVote).getFullYear() < new Date().getFullYear()) {
        project.stats.lastMonthSuccessVotes = project.stats.monthSuccessVotes
        project.stats.monthSuccessVotes = 0
    }
    project.stats.lastAttemptVote = Date.now()

    if (new Date(generalStats.lastAttemptVote).getMonth() < new Date().getMonth() || new Date(generalStats.lastAttemptVote).getFullYear() < new Date().getFullYear()) {
        generalStats.lastMonthSuccessVotes = generalStats.monthSuccessVotes
        generalStats.monthSuccessVotes = 0
    }
    generalStats.lastAttemptVote = Date.now()

    if (new Date(todayStats.lastAttemptVote).getDay() < new Date().getDay()) {
        todayStats = {
            successVotes: 0,
            errorVotes: 0,
            laterVotes: 0,
            lastSuccessVote: null,
            lastAttemptVote: null
        }
    }
    todayStats.lastAttemptVote = Date.now()
    await db.put('other', generalStats, 'generalStats')
    await db.put('other', todayStats, 'todayStats')
    await updateValue('projects', project)

    if (!settings.disabledRestartOnTimeout) {
        let create = true
        let alarms = await chrome.alarms.getAll()
        for (const alarm of alarms) {
            if (alarm.scheduledTime === opened.nextAttempt) {
                create = false
                break
            }
        }
        if (create) {
            let when = opened.nextAttempt
            if (when - Date.now() < TIME.MIN_ALARM_DELAY) when = Date.now() + TIME.MIN_ALARM_DELAY
            try {
                await chrome.alarms.create('nextAttempt_' + project.key, {when})
            } catch (error) {
                console.warn(getProjectPrefix(project, true), 'Ошибка при создании chrome.alarms', error.message)
            }
        }
    }

    let silentVoteMode = false
    if (project.rating === 'Custom') {
        silentVoteMode = true
    } else if (!project.emulateMode && allProjects[project.rating].silentVote?.(project)) {
        silentVoteMode = true
    }
    if (silentVoteMode) {
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

        if (notSupportedGroupTabs) return
        try {
            await promiseGroup
            promiseGroup = groupTabIntoAutoVoteGroup(tab, groupId)
            const newGroupId = await promiseGroup
            if (newGroupId !== null) groupId = newGroupId
        } catch (error) {
            if (error.message === 'Tabs cannot be edited right now (user may be dragging a tab).') {
                console.warn(getProjectPrefix(project, true), 'Error when grouping tabs,', error.message)
            } else {
                notSupportedGroupTabs = true
                console.warn(chrome.i18n.getMessage('notSupportedGroupTabs'), error.message)
            }
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
    const filesIsolated = []
    const filesMain = []
    if (details.frameId === 0) {
        // Через эти сайты пользователь может авторизоваться, я пока не поддерживаю автоматическую авторизацию, не мешаем ему в авторизации
        if (details.url.match(/facebook.com\/*/) || details.url.match(/google.com\/*/) || details.url.match(/accounts.google.com\/*/) || details.url.match(/reddit.com\/*/) || details.url.match(/twitter.com\/*/)) {
            return
        }
        // Если пользователь авторизовывается через эти сайты, но у расширения на это нет прав, всё равно не мешаем ему, пускай сам авторизуется не смотря, на то что есть автоматизация авторизации
        // if (details.url.match(/vk.com\/*/) || details.url.match(/discord.com\/*/) || details.url.startsWith('https://steamcommunity.com/openid/login') || details.url.startsWith('https://steamcommunity.com/login/home')) {
        //     // noinspection JSUnresolvedFunction
        //     let granted = await chrome.permissions.contains({origins: [details.url]})
        //     if (!granted) {
        //         return
        //     }
        // }

        filesMain.push('scripts/main/visible.js')
        if (allProjects[getDomainWithoutSubdomain(details.url)]?.needIsTrusted?.()) {
            filesIsolated.push('scripts/main/istrusted_isolated.js')
            filesMain.push('scripts/main/istrusted_main.js')
        }
        if (!allProjects[getDomainWithoutSubdomain(details.url)]?.dontUseAlert?.()) {
            filesIsolated.push('scripts/main/alert_isolated.js')
            filesMain.push('scripts/main/alert_main.js')
        }
    } else if (details.url.match(/hcaptcha.com\/captcha\/*/)
        || details.url.match(/https?:\/\/(.+?\.)?google.com\/recaptcha\/api.\/anchor*/)
        || details.url.match(/https?:\/\/(.+?\.)?google.com\/recaptcha\/api.\/bframe*/)
        || details.url.match(/https?:\/\/(.+?\.)?recaptcha.net\/recaptcha\/api.\/anchor*/)
        || details.url.match(/https?:\/\/(.+?\.)?recaptcha.net\/recaptcha\/api.\/bframe*/)
        || details.url.match(/https?:\/\/(.+?\.)?google.com\/recaptcha\/api\/fallback*/)
        || details.url.match(/https?:\/\/(.+?\.)?recaptcha.net\/recaptcha\/api\/fallback*/)
        || details.url.match(/https?:\/\/(.+?\.)?recaptcha.net\/recaptcha\/enterprise\/fallback*/)
        || details.url.match(/https?:\/\/(.+?\.)?google.com\/recaptcha\/enterprise\/anchor*/)
        || details.url.match(/https?:\/\/(.+?\.)?recaptcha.net\/recaptcha\/enterprise\/bframe*/)
        || details.url.match(/https:\/\/challenges.cloudflare.com\/*/)) {
        filesMain.push('scripts/main/visible.js')
        filesIsolated.push('scripts/main/alert_isolated.js')
        filesMain.push('scripts/main/alert_main.js')
    }

    if (!filesIsolated.length && !filesMain.length) return

    if (settings.debug) console.log('Injecting ' + JSON.stringify(filesIsolated) + ', ' + JSON.stringify(filesMain) + ' to ' + details.url)

    let target = {tabId: details.tabId}
    if (details.frameId) target.frameIds = [details.frameId]

    if (filesIsolated.length) {
        chrome.scripting.executeScript({target, files: filesIsolated, injectImmediately: true}, () => {
            const error = chrome.runtime.lastError
            if (error) {
                catchTabError(error, opened)
            }
        })
    }
    if (filesMain.length) {
        chrome.scripting.executeScript({target, files: filesMain, world: 'MAIN', injectImmediately: true}, () => {
            const error = chrome.runtime.lastError
            if (error) {
                catchTabError(error, opened)
            }
        })
    }
}

//Слушатель на обновление вкладок, если вкладка полностью загрузилась, загружает туда скрипт который сам нажимает кнопку проголосовать
const webNavigationOnCompletedListener = async function (details) {

    await initializeFunc
    let opened = openedProjects.get(details.tabId)
    if (!opened) return

    if (details.frameId === 0) {
        // Через эти сайты пользователь может авторизоваться, я пока не поддерживаю автоматическую авторизацию, не мешаем ему в авторизации
        if (details.url.match(/facebook.com\/*/) || details.url.match(/google.com\/*/) || details.url.match(/accounts.google.com\/*/) || details.url.match(/reddit.com\/*/) || details.url.match(/twitter.com\/*/)) {
            return
        }
        const project = await db.get('projects', opened.key)


        // Если пользователь авторизовывается через эти сайты, но у расширения на это нет прав, всё равно не мешаем ему, пускай сам авторизуется не смотря, на то что есть автоматизация авторизации
        // if (details.url.match(/vk.com\/*/) || details.url.match(/discord.com\/*/) || details.url.startsWith('https://steamcommunity.com/openid/login') || details.url.startsWith('https://steamcommunity.com/login/home')) {
        //     // noinspection JSUnresolvedFunction
        //     let granted = await chrome.permissions.contains({origins: [details.url]})
        //     if (!granted) {
        //         console.warn(getProjectPrefix(project, true), 'Not granted permissions for ' + details.url)
        //         return
        //     }
        // }

        if (opened.countInject >= LIMITS.MAX_INJECT_ATTEMPTS) {
            endVote({tooManyVoteAttempts: true}, {tab: {id: details.tabId}, url: details.url}, opened)
            return
        }

        try {
            if (allProjects[project.rating]?.needPrompt?.()) {
                const funcPrompt = function (nick) {
                    // noinspection JSUnusedLocalSymbols
                    window.prompt = new Proxy(window.prompt, {
                        apply(target, thisArg, argArray) {
                            return nick
                        }
                    })
                }
                if (settings.debug) console.log('Injecting funcPrompt to ' + details.url)
                await chrome.scripting.executeScript({
                    target: {tabId: details.tabId},
                    world: 'MAIN',
                    func: funcPrompt,
                    args: [project.nick]
                })
            }

            if (settings.debug) console.log('Injecting scripts/' + project.rating.toLowerCase() + '.js, scripts/main/api.js to ' + details.url)
            await chrome.scripting.executeScript({
                target: {tabId: details.tabId},
                files: ['scripts/main/hacktimer.js', 'scripts/' + (project.ratingMain || project.rating) + '.js', 'scripts/main/api.js']
            })
            // noinspection JSUnresolvedVariable,JSUnresolvedFunction
            if (allProjects[project.rating]?.needWorld?.()) {
                if (settings.debug) console.log('Injecting scripts/' + project.rating.toLowerCase() + '_world.js to ' + details.url + ' in MAIN world')
                await chrome.scripting.executeScript({
                    target: {tabId: details.tabId},
                    world: 'MAIN',
                    files: ['scripts/' + (project.ratingMain || project.rating) + '_world.js']
                })
            }

            await chrome.tabs.sendMessage(details.tabId, {sendProject: true, project, settings})

            if (openedProjects.has(details.tabId)) {
                opened.countInject++
                db.put('other', openedProjects, 'openedProjects')
            }
        } catch (error) {
            catchTabError(error, project)
        }
    } else if (details.frameId !== 0 && (
        details.url.match(/hcaptcha.com\/captcha\/*/)
        || details.url.includes('smartcaptcha.yandexcloud.net')
        || details.url.includes('service.mtcaptcha.com')
        || details.url.match(/https?:\/\/(.+?\.)?google.com\/recaptcha\/api.\/anchor*/)
        || details.url.match(/https?:\/\/(.+?\.)?google.com\/recaptcha\/api.\/bframe*/)
        || details.url.match(/https?:\/\/(.+?\.)?recaptcha.net\/recaptcha\/api.\/anchor*/)
        || details.url.match(/https?:\/\/(.+?\.)?recaptcha.net\/recaptcha\/api.\/bframe*/)
        || details.url.match(/https?:\/\/(.+?\.)?google.com\/recaptcha\/api\/fallback*/)
        || details.url.match(/https?:\/\/(.+?\.)?recaptcha.net\/recaptcha\/api\/fallback*/)
        || details.url.match(/https?:\/\/(.+?\.)?recaptcha.net\/recaptcha\/enterprise\/fallback*/)
        || details.url.match(/https?:\/\/(.+?\.)?google.com\/recaptcha\/enterprise\/anchor*/)
        || details.url.match(/https?:\/\/(.+?\.)?service\.mtcaptcha\.com\/mtcv1/)
        || details.url.match(/https:\/\/challenges.cloudflare.com\/*/))) {

        const project = await db.get('projects', opened.key)

        try {
            if (settings.debug) console.log('Injecting scripts/main/captchaclicker.js to ' + details.url)
            await chrome.scripting.executeScript({
                target: {tabId: details.tabId, frameIds: [details.frameId]},
                files: ['scripts/main/hacktimer.js', 'scripts/main/audio_captcha.js', 'scripts/main/captchaclicker.js']
            })

            // Если вкладка уже загружена, повторно туда высылаем sendProject который обозначает что мы готовы к голосованию
            const tab = await chrome.tabs.get(details.tabId)
            // TODO костыльная совместимость с Kiwi Browser, данный браузер в tab.status отдаёт undefined, нам ничего не остаётся кроме как игнорировать данный факт и голосовать как есть
            // не работоспособность данной проверки может привести к тому что капча может быть решена раньше чем страница загружена но такое обстоятельство весьма редкое
            // расширение отошлёт сообщение о пройденной капче ещё не внедрённому скрипту голосования что приведёт к зависанию голосования
            // например сайт ionmc.top загружает капчу раньше чем страница загрузилась
            if (tab.status != null && tab.status !== 'complete') return
            await chrome.tabs.sendMessage(details.tabId, {sendProject: true, project, settings})
        } catch (error) {
            catchTabError(error, project)
        }
    }
}

async function catchTabError(error, project) {
    if (error.message !== 'The frame was removed.' && !error.message.includes('No frame with id') && error.message !== 'The tab was closed.' && !error.message.includes('PrecompiledScript.executeInGlobal')/*Для FireFox мы игнорируем эту ошибку*/ && !error.message.includes('Could not establish connection. Receiving end does not exist') && !error.message.includes('The message port closed before a response was received') && (!error.message.includes('Frame with ID') && !error.message.includes('was removed'))) {
        project = await db.get('projects', project.key)
        let message = error.message
        if (message.includes('This page cannot be scripted due to an ExtensionsSettings policy')) {
            message += ' Try this solution: https://github.com/Serega007RU/Auto-Vote-Rating/wiki/Problems-with-Opera'
        }
        console.error(getProjectPrefix(project, true), error.message)
        sendNotification(getProjectPrefix(project, false), error.message, 'error', 'openProject_' + project.key)
        project.error = message
        updateValue('projects', project)
    }
}

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
    // noinspection JSUnresolvedVariable
    /*if ((details.initiator && details.initiator.includes(self.location.hostname) || (details.originUrl && details.originUrl.includes(self.location.hostname))) && fetchProjects.has(details.requestId)) {
        let project = fetchProjects.get(details.requestId)
        endVote({errorVoteNetwork: [details.error, details.url]}, null, project)
    } else */
    if (openedProjects.has(details.tabId)) {
        if (details.type === 'main_frame' || details.url.match(/hcaptcha.com\/captcha\/*/) || details.url.match(/https?:\/\/(.+?\.)?google.com\/recaptcha\/*/) || details.url.match(/https?:\/\/(.+?\.)?recaptcha.net\/recaptcha\/*/) || details.url.match(/https:\/\/challenges.cloudflare.com\/*/)) {
            const opened = openedProjects.get(details.tabId)
            if (
                //Chrome
                details.error.includes('net::ERR_ABORTED') || details.error.includes('net::ERR_CONNECTION_RESET') || details.error.includes('net::ERR_NETWORK_CHANGED') || details.error.includes('net::ERR_CACHE_MISS') || details.error.includes('net::ERR_BLOCKED_BY_CLIENT') || details.error.includes('net::ERR_QUIC_PROTOCOL_ERROR')
                //FireFox
                || details.error.includes('NS_BINDING_ABORTED') || details.error.includes('NS_ERROR_NET_ON_RESOLVED') || details.error.includes('NS_ERROR_NET_ON_RESOLVING') || details.error.includes('NS_ERROR_NET_ON_WAITING_FOR') || details.error.includes('NS_ERROR_NET_ON_CONNECTING_TO') || details.error.includes('NS_ERROR_FAILURE') || details.error.includes('NS_ERROR_DOCSHELL_DYING') || details.error.includes('NS_ERROR_NET_ON_TRANSACTION_CLOSE')) {
                // console.warn(getProjectPrefix(project, true), details.error)
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
        if (details.frameId === 0 || details.url.match(/hcaptcha.com\/captcha\/*/) || details.url.match(/https?:\/\/(.+?\.)?google.com\/recaptcha\/*/) || details.url.match(/https?:\/\/(.+?\.)?recaptcha.net\/recaptcha\/*/) || details.url.match(/https:\/\/challenges.cloudflare.com\/*/)) {
            const opened = openedProjects.get(details.tabId)
            if (
                //Chrome
                details.error.includes('net::ERR_ABORTED') || details.error.includes('net::ERR_CONNECTION_RESET') || details.error.includes('net::ERR_NETWORK_CHANGED') || details.error.includes('net::ERR_CACHE_MISS') || details.error.includes('net::ERR_BLOCKED_BY_CLIENT')
                //FireFox
                || details.error.includes('NS_BINDING_ABORTED') || details.error.includes('NS_ERROR_NET_ON_RESOLVED') || details.error.includes('NS_ERROR_NET_ON_RESOLVING') || details.error.includes('NS_ERROR_NET_ON_WAITING_FOR') || details.error.includes('NS_ERROR_NET_ON_CONNECTING_TO') || details.error.includes('NS_ERROR_FAILURE') || details.error.includes('NS_ERROR_DOCSHELL_DYING') || details.error.includes('NS_ERROR_NET_ON_TRANSACTION_CLOSE')) {
                // console.warn(getProjectPrefix(project, true), details.error)
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
    if (settings?.debug) console.log('Регистрация слушателей, включение', enable, 'openedProjects.size', openedProjects.size, 'openedProjects', openedProjects)
    if (enable) {
        if (!chrome.webNavigation.onErrorOccurred.hasListeners()) {
            if (settings?.debug) console.log('Регистрация слушателя webNavigation.onErrorOccurred')
            chrome.webNavigation.onErrorOccurred.addListener(webNavigationOnErrorOccurredListener)
        }
        if (!chrome.webNavigation.onCommitted.hasListeners()) {
            if (settings?.debug) console.log('Регистрация слушателя webNavigation.onCommitted')
            chrome.webNavigation.onCommitted.addListener(webNavigationOnCommittedListener)
        }
        if (!chrome.webNavigation.onCompleted.hasListeners()) {
            if (settings?.debug) console.log('Регистрация слушателя webNavigation.onCompleted')
            chrome.webNavigation.onCompleted.addListener(webNavigationOnCompletedListener)
        }
        if (!chrome.tabs.onRemoved.hasListeners()) {
            if (settings?.debug) console.log('Регистрация слушателя tabs.onRemoved')
            chrome.tabs.onRemoved.addListener(tabsOnRemovedListener)
        }
        if (!chrome.webRequest.onCompleted.hasListeners()) {
            if (settings?.debug) console.log('Регистрация слушателя webRequest.onCompleted')
            chrome.webRequest.onCompleted.addListener(webRequestOnCompletedListener, {urls: ['<all_urls>']})
        }
        if (!chrome.webRequest.onErrorOccurred.hasListeners()) {
            if (settings?.debug) console.log('Регистрация слушателя webRequest.onErrorOccurred')
            chrome.webRequest.onErrorOccurred.addListener(webRequestOnErrorOccurredListener, {urls: ['<all_urls>']})
        }
    } else {
        chrome.webNavigation.onErrorOccurred.removeListener(webNavigationOnErrorOccurredListener)
        chrome.webNavigation.onCommitted.removeListener(webNavigationOnCommittedListener)
        chrome.webNavigation.onCompleted.removeListener(webNavigationOnCompletedListener)
        chrome.tabs.onRemoved.removeListener(tabsOnRemovedListener)
        chrome.webRequest.onCompleted.removeListener(webRequestOnCompletedListener)
        chrome.webRequest.onErrorOccurred.removeListener(webRequestOnErrorOccurredListener)
    }
}

// Так как Service Worker может уснуть прямо во время голосования, мы прям при запуске всё равно регистрируем слушателей
// после инициализации базы данных если обнаруживается что сейчас мы не голосуем и нет необходимости голосовать - мы разрегистрируем слушатели
updateListeners(true)

// async function _fetch(url, options, project) {
//     let listener
//     const removeListener = ()=>{
//         if (listener) {
//             chrome.webRequest.onBeforeRequest.removeListener(listener)
//             listener = null
//         }
//     }
//
//     listener = (details)=>{
//         //Да это костыль, а есть другой адекватный вариант достать requestId или хотя бы код ошибки net::ERR из fetch запроса?
//         // noinspection JSUnresolvedVariable
//         if ((details.initiator && details.initiator.includes(self.location.hostname) || (details.originUrl && details.originUrl.includes(self.location.hostname))) && details.url.includes(url)) {
//             fetchProjects.set(details.requestId, project)
//             removeListener()
//         }
//     }
//     chrome.webRequest.onBeforeRequest.addListener(listener, {urls: ['<all_urls>']})
//
//     if (!options) options = {}
//
//     try {
//         return await fetch(url, options)
//     } catch(error) {
//         throw error
//     } finally {
//         removeListener()
//     }
// }

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
        // noinspection JSVoidFunctionReturnValueUsed,JSCheckFunctionSignatures
        const frames = await chrome.webNavigation.getAllFrames({tabId: sender.tab.id})
        for (const frame of frames) {
            // noinspection JSUnresolvedVariable
            if (frame.url.match(/https?:\/\/(.+?\.)?google.com\/recaptcha\/api.\/anchor*/) || frame.url.match(/https?:\/\/(.+?\.)?recaptcha.net\/recaptcha\/api.\/anchor*/) || frame.url.match(/https?:\/\/(.+?\.)?google.com\/recaptcha\/enterprise\/anchor*/)) {
                function reload() {
                    document.location.reload()
                }

                if (settings.debug) { // noinspection JSUnresolvedReference
                    console.log('Injecting funcReloadCaptcha to ' + frame.url)
                }
                // noinspection JSCheckFunctionSignatures,JSUnresolvedVariable
                await chrome.scripting.executeScript({
                    target: {tabId: sender.tab.id, frameIds: [frame.frameId]},
                    func: reload
                })
            }
        }
        return
    } else if (request.captchaPassed) {
        try {
            await chrome.tabs.sendMessage(sender.tab.id, request)
        } catch (error) {
            if (!error.message.includes('Could not establish connection. Receiving end does not exist') && !error.message.includes('The message port closed before a response was received')) {
                console.warn(error.message)
            }
        }
        if (request.captchaPassed !== 'double') return
    } else if (request.HackTimer) {
        if (request.name === 'setInterval') {
            fakeIdToId[request.fakeId] = setInterval(function () {
                triggerTimer(request.name, sender, request.fakeId);
            }, request.time);
        } else if (request.name === 'clearInterval') {
            clearInterval(fakeIdToId[request.fakeId]);
            delete fakeIdToId[request.fakeId];
        } else if (request.name === 'setTimeout') {
            fakeIdToId[request.fakeId] = setTimeout(function () {
                triggerTimer(request.name, sender, request.fakeId);
                delete fakeIdToId[request.fakeId];
            }, request.time);
        } else if (request.name === 'clearTimeout') {
            clearTimeout(fakeIdToId[request.fakeId]);
            delete fakeIdToId[request.fakeId];
        }
        return
    }

    await initializeFunc

    if (request === 'checkVote') {
        checkVote()
        return
    } else if (request === 'reloadAllSettings') {
        const store = db.transaction('other', 'readwrite').store
        settings = await store.get('settings')
        generalStats = await store.get('generalStats')
        todayStats = await store.get('todayStats')
        for (const [key, value] of openedProjects) {
            openedProjects.delete(key)
            tryCloseTab(key, value, 0)
        }
        await store.put(openedProjects, 'openedProjects')
        reloadAllAlarms()
        checkVote()
        return
    } else if (request === 'reloadSettings') {
        settings = await db.get('other', 'settings')
        return
    } else if (request.projectDeleted) {
        const transaction = db.transaction(['projects', 'other'], 'readwrite')
        let nowVoting = false
        //Если эта вкладка была уже открыта, он закрывает её
        for (const [key, value] of openedProjects) {
            if (request.projectDeleted.key === value.key) {
                if (key === 'start_' + request.projectDeleted.key) {
                    sendResponse('reject')
                    return
                }
                nowVoting = true
                openedProjects.delete(key)
                tryCloseTab(key, request.projectDeleted, 0)
                await transaction.objectStore('other').put(openedProjects, 'openedProjects')
                break
            }
        }
        await transaction.objectStore('projects').delete(request.projectDeleted.key)
        await chrome.alarms.clear(String(request.projectDeleted.key))
        if (nowVoting) {
            checkVote()
            console.log(getProjectPrefix(request.projectDeleted, true), chrome.i18n.getMessage('projectDeleted'))
        }
        sendResponse('success')
        return
    } else if (request.projectRestart) {
        const transaction = db.transaction(['projects', 'other'], 'readwrite')
        for (const [key, value] of openedProjects) {
            if (request.projectRestart.key === value.key) {
                if (request.confirmed) {
                    openedProjects.delete(key)
                    transaction.objectStore('other').put(openedProjects, 'openedProjects')
                    tryCloseTab(key, request.projectRestart, 0)
                    console.log(getProjectPrefix(request.projectRestart, true), chrome.i18n.getMessage('canceledVote'))
                } else {
                    sendResponse('confirmNow')
                    return
                }
            }
        }
        for (const [key, value] of openedProjects) {
            if (request.projectRestart.rating === value.rating || settings.disabledOneVote) {
                if (request.confirmed) {
                    openedProjects.delete(key)
                    await transaction.objectStore('other').put(openedProjects, 'openedProjects')
                    const project = await transaction.objectStore('projects').get(value.key)
                    tryCloseTab(key, project, 0)
                    console.log(getProjectPrefix(project, true), chrome.i18n.getMessage('canceledVote'))
                } else {
                    sendResponse('confirmQueue')
                    return
                }
            }
        }

        await chrome.alarms.clear(String(request.projectRestart.key))
        request.projectRestart.time = null
        await updateValue('projects', request.projectRestart)
        console.log(getProjectPrefix(request.projectRestart, true), chrome.i18n.getMessage('projectRestarted'))
        checkOpen(request.projectRestart)
        checkVote()
        sendResponse('success')
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
    if (request.captcha || request.authSteam || request.discordLogIn || request.auth || request.requiredConfirmTOS || (request.errorCaptcha && !request.restartVote) || request.restartVote === false || request.captchaPassed === 'double') {//Если требует ручное прохождение капчи
        const project = await db.get('projects', opened.key)
        let message
        if (request.captcha) {
            message = chrome.i18n.getMessage('requiresCaptcha')
        } else if (request.captchaPassed === 'double') {
            message = chrome.i18n.getMessage('captchaPassedDouble')
        } else if (request.message) {
            message = request.message
        } else {
            if (Object.values(request)[0] !== true) {
                message = chrome.i18n.getMessage(Object.keys(request)[0], Object.values(request)[0])
            } else {
                message = chrome.i18n.getMessage(Object.keys(request)[0])
            }
        }
        if (!(request.captcha && settings.disabledWarnCaptcha)) {
            console.warn(getProjectPrefix(project, true), message)
            sendNotification(getProjectPrefix(project, false), message, 'warn', 'openTab_' + sender.tab.id)
            project.error = message
        }
        updateValue('projects', project)
    } else {
        endVote(request, sender, opened)
    }
}

async function triggerTimer(name, sender, fakeId) {
    try {
        await chrome.tabs.sendMessage(sender.tab.id, {HackTimer: true, fakeId}, {
            documentId: sender.documentId,
            frameId: sender.frameId
        });
    } catch (error) {
        if (name === 'setInterval') clearInterval(fakeIdToId[fakeId]);
        delete fakeIdToId[fakeId];
    }
}

// Функции tryOpenTab, tryCloseTab, tryGroupTabs перенесены в utils/tab-manager.js

//Завершает голосование, если есть ошибка то обрабатывает её
async function endVote(request, sender, project) {
    let timeout = settings.timeout

    let opened
    for (const [tab, value] of openedProjects) {
        if (project.key === value.key) {
            if (!Number.isInteger(tab) && !tab.startsWith('background_') && !tab.startsWith('start_')) {
                console.warn('A double attempt to complete the vote? endVote, has openedProjects', JSON.stringify(request), JSON.stringify(sender), JSON.stringify(project))
                return
            } else {
                opened = createQueuedProject(value, timeout, project)
                openedProjects.set('queue_' + opened.key, opened)
                openedProjects.delete(tab)
                db.put('other', openedProjects, 'openedProjects')
            }
            break
        }
    }
    if (!opened) {
        console.warn('A double attempt to complete the vote? endVote, not found openedProjects', JSON.stringify(request), JSON.stringify(sender), JSON.stringify(project))
        return
    }

    project = await db.get('projects', project.key)

    if (!request.successfully && request.later == null) {
        if (sender?.url || request.url) {
            const url = sender?.url || request.url
            const domain = getDomainWithoutSubdomain(url)
            // Если мы попали не по адресу, ну значит не надо отсылать отчёт об ошибке
            if (domain !== project.rating) {
                request.incorrectDomain = domain
            }
        }
    }

    if (sender && !request.closedTab) {
        if (!request.successfully && request.later == null) {
            if (!settings.disableCloseTabsOnError) tryCloseTab(sender.tab.id, project, 0)
        } else {
            if (!settings.disableCloseTabsOnSuccess) tryCloseTab(sender.tab.id, project, 0)
        }
    }

    // for (const[key,value] of fetchProjects) {
    //     if (value.key === project.key) {
    //         fetchProjects.delete(key)
    //     }
    // }

    // Повторно достаём project так как за время отправки отчёта или использования удалённого кода он мог измениться
    project = await db.get('projects', project.key)

    //Если усё успешно
    let sendMessage
    if (request.successfully || request.later != null) {
        let time = new Date()
        if (project.rating === 'Custom' || ((project.timeout != null || project.timeoutHour != null) && !Number.isInteger(request.later) && !(project.lastDayMonth && new Date(time.getFullYear(), time.getMonth(), time.getDay() + 1).getMonth() === new Date().getMonth()))) {
            if (project.timeoutHour != null) {
                if (project.timeoutMinute == null) project.timeoutMinute = 0
                if (project.timeoutSecond == null) project.timeoutSecond = 0
                if (project.timeoutMS == null) project.timeoutMS = 0

                let month = time.getMonth()
                let date = time.getDate()

                let needCalculateDate = true
                if (project.timeoutWeek != null) {
                    // https://stackoverflow.com/a/11789820/11235240
                    const distance = (project.timeoutWeek + 7 - time.getDay()) % 7
                    if (distance > 0) {
                        needCalculateDate = false
                        date += distance
                    }
                } else if (project.timeoutMonth != null) {
                    if (time.getDate() !== project.timeoutMonth) {
                        needCalculateDate = false
                        if (time.getDate() > project.timeoutMonth) month += 1
                        date = project.timeoutMonth
                    }
                }
                if (needCalculateDate) {
                    if (time.getHours() > project.timeoutHour || (time.getHours() === project.timeoutHour && time.getMinutes() >= project.timeoutMinute)) {
                        if (project.timeoutWeek != null) {
                            date += 7
                        } else if (project.timeoutMonth != null) {
                            month += 1
                            date = project.timeoutMonth
                        } else {
                            date += 1
                        }
                    }
                }

                time = new Date(time.getFullYear(), month, date, project.timeoutHour, project.timeoutMinute, project.timeoutSecond, project.timeoutMS)
            } else {
                time.setUTCMilliseconds(time.getUTCMilliseconds() + project.timeout)
            }
        } else if (request.later && Number.isInteger(request.later)) {
            let needSetTime = true
            if (allProjects[project.rating]?.limitedCountVote?.()) {
                project.countVote = project.countVote + 1
                if (project.countVote >= project.maxCountVote) {
                    needSetTime = false
                    time = new Date(time.getFullYear(), time.getMonth(), time.getDate() + 1, 0, (project.priority ? 0 : 10), 0, 0)
                }
            }
            if (needSetTime) {
                time = new Date(request.later)
            }
        } else {
            const timeoutRating = allProjects[project.rating]?.timeout?.(project)
            if (Number.isInteger(request.successfully)) {
                time = new Date(request.successfully)
            } else if (!timeoutRating) {
                //Если нам не известен таймаут, ставим по умолчанию +24 часа
                time.setUTCDate(time.getUTCDate() + 1)
            } else if (timeoutRating.week != null) {
                let date = time.getUTCDate()
                // https://stackoverflow.com/a/11789820/11235240
                const distance = (timeoutRating.week + 7 - time.getUTCDay()) % 7
                if (distance > 0) {
                    date += distance
                } else {
                    if (time.getUTCHours() >= timeoutRating.hour) {
                        date += 7
                    }
                }
                time = new Date(Date.UTC(time.getUTCFullYear(), time.getUTCMonth(), date, timeoutRating.hour, (project.priority ? 0 : 10), 0, 0))
            } else if (timeoutRating.month != null) {
                let month = time.getUTCMonth()
                let date = time.getUTCDate()
                if (time.getUTCDate() !== timeoutRating.month) {
                    if (time.getUTCDate() > timeoutRating.month) month += 1
                    date = timeoutRating.month
                } else {
                    if (time.getUTCHours() >= timeoutRating.hour) {
                        month += 1
                        date = timeoutRating.month
                    }
                }
                time = new Date(Date.UTC(time.getUTCFullYear(), month, date, timeoutRating.hour, (project.priority ? 0 : 10), 0, 0))
            } else if (timeoutRating.hour != null) {
                //Рейтинги с таймаутом сбрасывающемся раз в день в определённый час
                let date = time.getUTCHours() >= timeoutRating.hour ? time.getUTCDate() + 1 : time.getUTCDate()
                time = new Date(Date.UTC(time.getUTCFullYear(), time.getUTCMonth(), date, timeoutRating.hour, (project.priority ? 0 : 10), 0, 0))
            } else if (timeoutRating.hours != null) {
                let needSetTime = true
                //Рейтинги с таймаутом сбрасывающемся через определённый промежуток времени с момента последнего голосования
                if (allProjects[project.rating]?.limitedCountVote?.()) {
                    project.countVote = project.countVote + 1
                    if (project.countVote >= project.maxCountVote) {
                        needSetTime = false
                        time = new Date(time.getFullYear(), time.getMonth(), time.getDate() + 1, 0, (project.priority ? 0 : 10), 0, 0)
                        project.countVote = 0
                    }
                }
                if (needSetTime) {
                    // Если later=true, используем время последнего успешного голосования вместо текущего
                    if (request.later === true && project.stats.lastSuccessVote) {
                        time = new Date(project.stats.lastSuccessVote)
                    }
                    let hours = time.getHours() + timeoutRating.hours
                    let minutes = time.getMinutes()
                    let seconds = time.getSeconds()
                    let milliseconds = time.getMilliseconds()
                    if (timeoutRating.minutes != null) minutes += timeoutRating.minutes
                    // noinspection JSUnresolvedVariable
                    if (timeoutRating.seconds != null) seconds += timeoutRating.seconds
                    // noinspection JSUnresolvedVariable
                    if (timeoutRating.milliseconds != null) milliseconds += timeoutRating.milliseconds
                    time = new Date(time.getFullYear(), time.getMonth(), time.getDate(), hours, minutes, seconds, milliseconds)
                }
            }
        }

        time = time.getTime()
        project.time = time

        if (project.randomize) {
            if (project.randomize.min == null) {
                project.randomize = {}
                project.randomize.min = 0
                project.randomize.max = 43200000
            }
            project.time = project.time + Math.floor(Math.random() * (project.randomize.max - project.randomize.min) + project.randomize.min)
        } else if ((project.rating === 'topcraft.ru' || project.rating === 'topcraft.club' || project.rating === 'mctop.su' || (project.rating === 'minecraftrating.ru' && project.listing === 'projects')) && !project.priority && project.timeoutHour == null) {
            //Рандомизация по умолчанию (в пределах 5-10 минут) для бедного TopCraft/McTOP который легко ддосится от массового автоматического голосования
            project.time = project.time + Math.floor(Math.random() * (TIME.MAX_RANDOMIZATION_DEFAULT - TIME.MIN_RANDOMIZATION_DEFAULT) + TIME.MIN_RANDOMIZATION_DEFAULT)
        }

        delete project.error
        delete project.warn

        if (request.successfully) {
            if (typeof request.successfully === 'string') {
                project.warn = request.successfully
                sendMessage = chrome.i18n.getMessage('successAutoVoteWarn', request.successfully)
            } else {
                sendMessage = chrome.i18n.getMessage('successAutoVote')
            }

            sendNotification(getProjectPrefix(project, false), sendMessage, 'info', 'openProject_' + project.key)

            project.stats.successVotes++
            project.stats.monthSuccessVotes++
            project.stats.lastSuccessVote = Date.now()

            generalStats.successVotes++
            generalStats.monthSuccessVotes++
            generalStats.lastSuccessVote = Date.now()
            todayStats.successVotes++
            todayStats.lastSuccessVote = Date.now()
        } else {
            if (typeof request.later === 'string') {
                project.warn = request.later
                sendMessage = chrome.i18n.getMessage('alreadyVotedWarn', request.later)
            } else {
                sendMessage = chrome.i18n.getMessage('alreadyVoted')
            }

            sendNotification(getProjectPrefix(project, false), sendMessage, project.warn ? 'warn' : 'info', 'openProject_' + project.key)

            project.stats.laterVotes++

            generalStats.laterVotes++
            todayStats.laterVotes++
        }
        console.log(getProjectPrefix(project, true), sendMessage + ', ' + chrome.i18n.getMessage('timeStamp') + ' ' + project.time)
        //Если ошибка
    } else {
        let message
        if (!request.message) {
            const name = Object.keys(request)[0]
            if (Object.values(request)[0] === true) {
                message = chrome.i18n.getMessage(name)
            } else {
                message = chrome.i18n.getMessage(name, Object.values(request)[0])
            }
            if (request.usedTranslator && name !== 'usedTranslator') {
                message += ' ' + chrome.i18n.getMessage('usedTranslator')
            }
        } else {
            message = chrome.i18n.getMessage('siteError', request.message)
        }
        if (message.length === 0) message = chrome.i18n.getMessage('emptyError')
        if (request.incorrectDomain) {
            message += ' Incorrect domain ' + request.incorrectDomain
        }
        let retryCoolDown
        if (request.retryCoolDown) {
            retryCoolDown = request.retryCoolDown
        } else if ((request.errorVote && request.errorVote[0] === '404') || (request.message && project.rating === 'wargm.ru' && project.randomize)) {
            retryCoolDown = TIME.ERROR_404_COOLDOWN
        } else if (request.closedTab) {
            retryCoolDown = 60000
        } else {
            retryCoolDown = settings.timeoutError
        }

        sendMessage = message + '. ' + chrome.i18n.getMessage('errorNextVote', (Math.round(retryCoolDown / 1000 / 60 * 100) / 100).toString())

        if (project.randomize) {
            retryCoolDown = retryCoolDown + Math.floor(Math.random() * TIME.MAX_ERROR_RANDOMIZATION)
        }
        project.time = Date.now() + retryCoolDown
        project.error = message
        console.error(getProjectPrefix(project, true), sendMessage + ', ' + chrome.i18n.getMessage('timeStamp') + ' ' + project.time)
        if (!(request.errorVote && request.errorVote[0].charAt(0) === '5')) sendNotification(getProjectPrefix(project, false), sendMessage, 'error', 'openProject_' + project.key)

        project.stats.errorVotes++

        generalStats.errorVotes++
        todayStats.errorVotes++
    }

    await db.put('other', generalStats, 'generalStats')
    await db.put('other', todayStats, 'todayStats')
    await updateValue('projects', project)

    await chrome.alarms.clear('nextAttempt_' + project.key)
    if (project.time != null && project.time > Date.now()) {
        let create2 = true
        let when = project.time
        if (when - Date.now() < TIME.MIN_ALARM_DELAY) when = Date.now() + TIME.MIN_ALARM_DELAY
        const alarms = await chrome.alarms.getAll()
        for (const alarm of alarms) {
            // noinspection JSCheckFunctionSignatures
            if (!isNaN(alarm.name) && alarm.scheduledTime === when) {
                create2 = false
                break
            }
        }
        if (create2) {
            try {
                await chrome.alarms.create(String(project.key), {when})
            } catch (error) {
                console.warn(getProjectPrefix(project, true), 'Ошибка при создании chrome.alarms', error.message)
            }
        }
    }

    async function removeQueue() {
        for (const [tab, value] of openedProjects) {
            if (tab.startsWith?.('queue_') && project.key === value.key) {
                openedProjects.delete(tab)
            }
        }
        db.put('other', openedProjects, 'openedProjects')
        checkVote()
    }

    setTimeout(() => {
        removeQueue()
    }, timeout)

    // TODO мы не можем быть уверены что setTimeout в Service Worker 100% отработает, поэтому мы на всякий случай создаём chrome.alarm
    let alarmTimeout = timeout
    if (alarmTimeout < TIME.MIN_ALARM_DELAY) alarmTimeout = TIME.MIN_ALARM_DELAY
    try {
        await chrome.alarms.create('checkVote', {when: Date.now() + alarmTimeout})
    } catch (error) {
        console.warn(getProjectPrefix(project, true), 'Ошибка при создании chrome.alarms', error.message)
    }
}


chrome.notifications.onClicked.addListener(async function (notificationId) {
    if (notificationId.startsWith('openTab_')) {
        try {
            const tabId = Number(notificationId.replace('openTab_', ''))
            if (!tabId) return
            const tab = await chrome.tabs.update(tabId, {active: true})
            if (!tab) return
            await chrome.windows.update(tab.windowId, {focused: true})
        } catch (error) {
            if (!error.message.includes('No tab with id')) {
                console.warn('Ошибка при фокусировке на вкладку', error.message)
            }
        }
    } else if (notificationId.startsWith('openProject_')) {
        try {
            const projectKey = Number(notificationId.replace('openProject_', ''))
            const found = await db.count('projects', projectKey)
            if (!found) return
            await openOptionsPage()
            await chrome.runtime.sendMessage({openProject: projectKey})
        } catch (error) {
            console.warn('Ошибка открытия настроек с определённым проектом', error.message)
        }
    } else if (notificationId.startsWith('openSettings')) {
        await chrome.runtime.openOptionsPage()
    }
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
    // noinspection JSUnresolvedReference
    if (!settings.operaAttention2 && (navigator?.userAgentData?.brands?.[0]?.brand === 'Opera' || (!!self.opr && !!opr.addons) || !!self.opera || navigator.userAgent.indexOf(' OPR/') >= 0)) {
        chrome.runtime.openOptionsPage()
        return
    }
    if (details.reason === 'install') {
        await openOptionsPage()
        chrome.runtime.sendMessage({installed: true})
    } else if (details.reason === 'update') {
        checkVote()
    }/* else if (details.reason === 'update' && details.previousVersion && (new Version(details.previousVersion)).compareTo(new Version('6.0.0')) === -1) {

    }*/
})

// function Version(s){
//   this.arr = s.split('.').map(Number)
// }
// Version.prototype.compareTo = function(v){
//     for (let i=0; ;i++) {
//         if (i>=v.arr.length) return i>=this.arr.length ? 0 : 1
//         if (i>=this.arr.length) return -1
//         const diff = this.arr[i]-v.arr[i]
//         if (diff) return diff>0 ? 1 : -1
//     }
// }



/*
Открытый репозиторий:
https://github.com/Serega007RU/Auto-Vote-Rating/
*/