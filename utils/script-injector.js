/**
 * Утилиты для инъекции скриптов в веб-страницы
 */

/**
 * Определяет какие скрипты нужно инъектировать для данной навигации
 * @param {Object} details - Детали навигации от webNavigation API
 * @param {Function} getDomainWithoutSubdomain - Функция получения домена
 * @param {Function} isCaptchaUrlForCommitted - Функция проверки URL капчи
 * @param {Object} allProjects - Конфигурации всех проектов
 * @returns {{filesIsolated: string[], filesMain: string[]}} Списки файлов для инъекции
 */
function determineScriptsToInject(details, getDomainWithoutSubdomain, isCaptchaUrlForCommitted, allProjects) {
    const filesIsolated = []
    const filesMain = []

    if (details.frameId === 0) {
        // Основной фрейм
        filesMain.push('scripts/main/visible.js')

        const domain = getDomainWithoutSubdomain(details.url)

        if (allProjects[domain]?.needIsTrusted?.()) {
            filesIsolated.push('scripts/main/istrusted_isolated.js')
            filesMain.push('scripts/main/istrusted_main.js')
        }

        if (!allProjects[domain]?.dontUseAlert?.()) {
            filesIsolated.push('scripts/main/alert_isolated.js')
            filesMain.push('scripts/main/alert_main.js')
        }
    } else if (isCaptchaUrlForCommitted(details.url)) {
        // Фрейм с капчей
        filesMain.push('scripts/main/visible.js')
        filesIsolated.push('scripts/main/alert_isolated.js')
        filesMain.push('scripts/main/alert_main.js')
    }

    return {filesIsolated, filesMain}
}

/**
 * Выполняет инъекцию скриптов в указанную вкладку
 * @param {number} tabId - ID вкладки
 * @param {number} frameId - ID фрейма (0 для основного)
 * @param {string[]} filesIsolated - Файлы для isolated world
 * @param {string[]} filesMain - Файлы для MAIN world
 * @param {Function} catchTabError - Callback для обработки ошибок
 * @param {Object} opened - Объект opened проекта
 * @param {Object} db - База данных
 * @param {boolean} debug - Режим отладки
 * @param {string} url - URL для логирования
 */
function executeScriptInjection(tabId, frameId, filesIsolated, filesMain, catchTabError, opened, db, debug, url) {
    if (!filesIsolated.length && !filesMain.length) return

    if (debug) {
        console.log('Injecting ' + JSON.stringify(filesIsolated) + ', ' + JSON.stringify(filesMain) + ' to ' + url)
    }

    const target = {tabId}
    if (frameId) target.frameIds = [frameId]

    if (filesIsolated.length) {
        chrome.scripting.executeScript(
            {target, files: filesIsolated, injectImmediately: true},
            () => {
                const error = chrome.runtime.lastError
                if (error) {
                    catchTabError(error, opened, db)
                }
            }
        )
    }

    if (filesMain.length) {
        chrome.scripting.executeScript(
            {target, files: filesMain, world: 'MAIN', injectImmediately: true},
            () => {
                const error = chrome.runtime.lastError
                if (error) {
                    catchTabError(error, opened, db)
                }
            }
        )
    }
}

/**
 * Инъектирует скрипты голосования в основной фрейм
 * @async
 * @param {number} tabId - ID вкладки
 * @param {Object} project - Объект проекта
 * @param {Object} settings - Настройки расширения
 * @param {Object} allProjects - Конфигурации всех проектов
 * @param {boolean} debug - Режим отладки
 * @param {string} url - URL для логирования
 * @returns {Promise<void>}
 */
async function injectVoteScripts(tabId, project, settings, allProjects, debug, url) {
    // Инъекция prompt если требуется
    if (allProjects[project.rating]?.needPrompt?.()) {
        const funcPrompt = function (nick) {
            // noinspection JSUnusedLocalSymbols
            window.prompt = new Proxy(window.prompt, {
                apply(target, thisArg, argArray) {
                    return nick
                }
            })
        }
        if (debug) console.log('Injecting funcPrompt to ' + url)
        await chrome.scripting.executeScript({
            target: {tabId},
            world: 'MAIN',
            func: funcPrompt,
            args: [project.nick]
        })
    }

    // Инъекция основных скриптов голосования
    if (debug) console.log('Injecting scripts/' + project.rating.toLowerCase() + '.js, scripts/main/api.js to ' + url)
    await chrome.scripting.executeScript({
        target: {tabId},
        files: ['scripts/main/hacktimer.js', 'scripts/' + (project.ratingMain || project.rating) + '.js', 'scripts/main/api.js']
    })

    // Инъекция world скрипта если требуется
    // noinspection JSUnresolvedVariable,JSUnresolvedFunction
    if (allProjects[project.rating]?.needWorld?.()) {
        if (debug) console.log('Injecting scripts/' + project.rating.toLowerCase() + '_world.js to ' + url + ' in MAIN world')
        await chrome.scripting.executeScript({
            target: {tabId},
            world: 'MAIN',
            files: ['scripts/' + (project.ratingMain || project.rating) + '_world.js']
        })
    }

    // Отправка проекта в контент скрипт
    await chrome.tabs.sendMessage(tabId, {sendProject: true, project, settings})
}

/**
 * Инъектирует скрипты для решения капчи
 * @async
 * @param {number} tabId - ID вкладки
 * @param {number} frameId - ID фрейма с капчей
 * @param {Object} project - Объект проекта
 * @param {Object} settings - Настройки расширения
 * @param {boolean} debug - Режим отладки
 * @param {string} url - URL для логирования
 * @returns {Promise<void>}
 */
async function injectCaptchaScripts(tabId, frameId, project, settings, debug, url) {
    if (debug) console.log('Injecting scripts/main/captchaclicker.js to ' + url)
    await chrome.scripting.executeScript({
        target: {tabId, frameIds: [frameId]},
        files: ['scripts/main/hacktimer.js', 'scripts/main/audio_captcha.js', 'scripts/main/captchaclicker.js']
    })

    // Проверка статуса вкладки перед отправкой сообщения
    const tab = await chrome.tabs.get(tabId)
    // TODO костыльная совместимость с Kiwi Browser, данный браузер в tab.status отдаёт undefined
    // не работоспособность данной проверки может привести к тому что капча может быть решена раньше чем страница загружена
    if (tab.status != null && tab.status !== 'complete') return

    await chrome.tabs.sendMessage(tabId, {sendProject: true, project, settings})
}
