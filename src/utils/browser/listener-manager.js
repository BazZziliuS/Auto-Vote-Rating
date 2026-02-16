/**
 * Утилиты для управления регистрацией слушателей событий Chrome API
 */

/**
 * Регистрирует или разрегистрирует слушатель события
 * @param {Object} eventSource - Объект события (например, chrome.webNavigation.onCompleted)
 * @param {Function} listener - Функция-слушатель
 * @param {boolean} enable - true для регистрации, false для разрегистрации
 * @param {string} eventName - Название события для логирования
 * @param {Object} [options] - Дополнительные опции для addListener (например, {urls: ['<all_urls>']})
 * @param {boolean} [debug] - Режим отладки
 */
function manageListener(eventSource, listener, enable, eventName, options = null, debug = false) {
    if (enable) {
        if (!eventSource.hasListeners()) {
            if (debug) console.log('Регистрация слушателя ' + eventName)
            if (options) {
                eventSource.addListener(listener, options)
            } else {
                eventSource.addListener(listener)
            }
        }
    } else {
        eventSource.removeListener(listener)
    }
}

/**
 * Управляет регистрацией/разрегистрацией всех слушателей для голосования
 * @param {boolean} enable - true для регистрации, false для разрегистрации слушателей
 * @param {Object} listeners - Объект с listener функциями
 * @param {Object} openedProjects - Map открытых проектов
 * @param {Object} settings - Настройки расширения
 */
function updateAllVoteListeners(enable, listeners, openedProjects, settings) {
    if (settings?.debug) {
        console.log('Регистрация слушателей, включение', enable, 'openedProjects.size', openedProjects.size, 'openedProjects', openedProjects)
    }

    // Список всех listener'ов для регистрации
    const listenerConfigs = [
        {
            event: chrome.webNavigation.onErrorOccurred,
            listener: listeners.webNavigationOnErrorOccurred,
            name: 'webNavigation.onErrorOccurred'
        },
        {
            event: chrome.webNavigation.onCommitted,
            listener: listeners.webNavigationOnCommitted,
            name: 'webNavigation.onCommitted'
        },
        {
            event: chrome.webNavigation.onCompleted,
            listener: listeners.webNavigationOnCompleted,
            name: 'webNavigation.onCompleted'
        },
        {
            event: chrome.tabs.onRemoved,
            listener: listeners.tabsOnRemoved,
            name: 'tabs.onRemoved'
        },
        {
            event: chrome.webRequest.onCompleted,
            listener: listeners.webRequestOnCompleted,
            name: 'webRequest.onCompleted',
            options: {urls: ['<all_urls>']}
        },
        {
            event: chrome.webRequest.onErrorOccurred,
            listener: listeners.webRequestOnErrorOccurred,
            name: 'webRequest.onErrorOccurred',
            options: {urls: ['<all_urls>']}
        }
    ]

    // Регистрация/разрегистрация всех listener'ов
    for (const config of listenerConfigs) {
        manageListener(
            config.event,
            config.listener,
            enable,
            config.name,
            config.options,
            settings?.debug
        )
    }
}
