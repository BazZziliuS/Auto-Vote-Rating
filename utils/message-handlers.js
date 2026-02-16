/**
 * Обработчики сообщений для chrome.runtime.onMessage
 */

/**
 * Обрабатывает сообщение о перезагрузке капчи
 * @async
 * @param {Object} sender - Отправитель сообщения
 * @param {Object} settings - Настройки расширения
 * @returns {Promise<void>}
 */
async function handleReloadCaptcha(sender, settings) {
    const frames = await chrome.webNavigation.getAllFrames({tabId: sender.tab.id})
    for (const frame of frames) {
        if (frame.url.match(/https?:\/\/(.+?\.)?google.com\/recaptcha\/api.\/anchor*/) ||
            frame.url.match(/https?:\/\/(.+?\.)?recaptcha.net\/recaptcha\/api.\/anchor*/) ||
            frame.url.match(/https?:\/\/(.+?\.)?google.com\/recaptcha\/enterprise\/anchor*/)) {

            function reload() {
                document.location.reload()
            }

            if (settings.debug) {
                console.log('Injecting funcReloadCaptcha to ' + frame.url)
            }

            await chrome.scripting.executeScript({
                target: {tabId: sender.tab.id, frameIds: [frame.frameId]},
                func: reload
            })
        }
    }
}

/**
 * Обрабатывает сообщение о пройденной капче
 * @async
 * @param {Object} request - Объект запроса
 * @param {Object} sender - Отправитель сообщения
 * @returns {Promise<void>}
 */
async function handleCaptchaPassed(request, sender) {
    try {
        await chrome.tabs.sendMessage(sender.tab.id, request)
    } catch (error) {
        if (!error.message.includes('Could not establish connection. Receiving end does not exist') &&
            !error.message.includes('The message port closed before a response was received')) {
            console.warn(error.message)
        }
    }
}

/**
 * Обрабатывает сообщения HackTimer (таймеры в background)
 * @param {Object} request - Объект запроса
 * @param {Object} sender - Отправитель сообщения
 * @param {Object} fakeIdToId - Map для хранения ID таймеров
 */
function handleHackTimer(request, sender, fakeIdToId) {
    if (request.name === 'setInterval') {
        fakeIdToId[request.fakeId] = setInterval(function () {
            triggerTimer(request.name, sender, request.fakeId, fakeIdToId)
        }, request.time)
    } else if (request.name === 'clearInterval') {
        clearInterval(fakeIdToId[request.fakeId])
        delete fakeIdToId[request.fakeId]
    } else if (request.name === 'setTimeout') {
        fakeIdToId[request.fakeId] = setTimeout(function () {
            triggerTimer(request.name, sender, request.fakeId, fakeIdToId)
            delete fakeIdToId[request.fakeId]
        }, request.time)
    } else if (request.name === 'clearTimeout') {
        clearTimeout(fakeIdToId[request.fakeId])
        delete fakeIdToId[request.fakeId]
    }
}

/**
 * Триггерит таймер в content script
 * @async
 * @param {string} name - Имя таймера
 * @param {Object} sender - Отправитель
 * @param {number} fakeId - ID таймера
 * @param {Object} fakeIdToId - Map таймеров
 */
async function triggerTimer(name, sender, fakeId, fakeIdToId) {
    try {
        await chrome.tabs.sendMessage(sender.tab.id, {HackTimer: true, fakeId}, {
            documentId: sender.documentId,
            frameId: sender.frameId
        })
    } catch (error) {
        if (name === 'setInterval') clearInterval(fakeIdToId[fakeId])
        delete fakeIdToId[fakeId]
    }
}

/**
 * Обрабатывает удаление проекта
 * @async
 * @param {Object} request - Запрос с projectDeleted
 * @param {Map} openedProjects - Map открытых проектов
 * @param {Object} db - База данных
 * @returns {Promise<string>} 'success' или 'reject'
 */
async function handleProjectDeleted(request, openedProjects, db) {
    const transaction = db.transaction(['projects', 'other'], 'readwrite')
    let nowVoting = false

    // Проверяем, не голосуем ли мы сейчас за этот проект
    for (const [key, value] of openedProjects) {
        if (request.projectDeleted.key === value.key) {
            if (key === 'start_' + request.projectDeleted.key) {
                return 'reject'
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

    return 'success'
}

/**
 * Обрабатывает ситуации требующие ручного действия (капча, авторизация и т.д.)
 * @async
 * @param {Object} request - Объект запроса
 * @param {Object} sender - Отправитель сообщения
 * @param {Object} opened - Открытый проект
 * @param {Object} settings - Настройки расширения
 * @param {Object} db - База данных
 * @returns {Promise<void>}
 */
async function handleManualActionRequired(request, sender, opened, settings, db) {
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
}

/**
 * Проверяет требуется ли ручное действие для запроса
 * @param {Object} request - Объект запроса
 * @returns {boolean} true если требуется ручное действие
 */
function requiresManualAction(request) {
    return request.captcha ||
           request.authSteam ||
           request.discordLogIn ||
           request.auth ||
           request.requiredConfirmTOS ||
           (request.errorCaptcha && !request.restartVote) ||
           request.restartVote === false ||
           request.captchaPassed === 'double'
}

/**
 * Обрабатывает перезапуск проекта
 * @async
 * @param {Object} request - Запрос с projectRestart
 * @param {Map} openedProjects - Map открытых проектов
 * @param {Object} db - База данных
 * @param {Object} settings - Настройки
 * @returns {Promise<string>} 'success', 'confirmNow' или 'confirmQueue'
 */
async function handleProjectRestart(request, openedProjects, db, settings) {
    const transaction = db.transaction(['projects', 'other'], 'readwrite')

    // Проверяем текущий проект
    for (const [key, value] of openedProjects) {
        if (request.projectRestart.key === value.key) {
            if (request.confirmed) {
                openedProjects.delete(key)
                await transaction.objectStore('other').put(openedProjects, 'openedProjects')
                tryCloseTab(key, request.projectRestart, 0)
                console.log(getProjectPrefix(request.projectRestart, true), chrome.i18n.getMessage('canceledVote'))
            } else {
                return 'confirmNow'
            }
        }
    }

    // Проверяем конфликтующие проекты
    for (const [key, value] of openedProjects) {
        if (request.projectRestart.rating === value.rating || settings.disabledOneVote) {
            if (request.confirmed) {
                openedProjects.delete(key)
                await transaction.objectStore('other').put(openedProjects, 'openedProjects')
                const project = await transaction.objectStore('projects').get(value.key)
                tryCloseTab(key, project, 0)
                console.log(getProjectPrefix(project, true), chrome.i18n.getMessage('canceledVote'))
            } else {
                return 'confirmQueue'
            }
        }
    }

    await chrome.alarms.clear(String(request.projectRestart.key))
    request.projectRestart.time = null
    await updateValue('projects', request.projectRestart)
    console.log(getProjectPrefix(request.projectRestart, true), chrome.i18n.getMessage('projectRestarted'))

    // Запускаем голосование для перезапущенного проекта
    await checkOpen(request.projectRestart, transaction)
    checkVote()

    return 'success'
}

/**
 * Обрабатывает сообщение о полной перезагрузке настроек
 * Перезагружает все настройки, закрывает открытые вкладки голосования и перезапускает все алармы
 * @async
 * @param {Object} db - База данных
 * @param {Map} openedProjects - Map открытых проектов
 * @param {Function} tryCloseTab - Функция закрытия вкладки
 * @param {Function} reloadAllAlarms - Функция перезагрузки всех алармов
 * @param {Function} checkVote - Функция проверки голосования
 * @returns {Promise<{settings: Object, generalStats: Object, todayStats: Object}>} Обновленные настройки и статистика
 */
async function handleReloadAllSettings(db, openedProjects, tryCloseTab, reloadAllAlarms, checkVote) {
    const store = db.transaction('other', 'readwrite').store
    const settings = await store.get('settings')
    const generalStats = await store.get('generalStats')
    const todayStats = await store.get('todayStats')

    // Закрываем все открытые вкладки голосования
    for (const [key, value] of openedProjects) {
        openedProjects.delete(key)
        tryCloseTab(key, value, 0)
    }

    await store.put(openedProjects, 'openedProjects')
    reloadAllAlarms()
    checkVote()

    return {settings, generalStats, todayStats}
}
