/**
 * Утилиты для обработки кликов по уведомлениям
 */

/**
 * Обрабатывает клик по уведомлению для фокусировки на вкладку
 * @async
 * @param {string} notificationId - ID уведомления вида "openTab_123"
 * @returns {Promise<void>}
 */
async function handleOpenTabNotification(notificationId) {
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
}

/**
 * Обрабатывает клик по уведомлению для открытия проекта в настройках
 * @async
 * @param {string} notificationId - ID уведомления вида "openProject_123"
 * @param {Object} db - База данных
 * @param {Function} openOptionsPageFunc - Функция открытия страницы настроек
 * @returns {Promise<void>}
 */
async function handleOpenProjectNotification(notificationId, db, openOptionsPageFunc) {
    try {
        const projectKey = Number(notificationId.replace('openProject_', ''))
        const found = await db.count('projects', projectKey)
        if (!found) return

        await openOptionsPageFunc()
        await chrome.runtime.sendMessage({openProject: projectKey})
    } catch (error) {
        console.warn('Ошибка открытия настроек с определённым проектом', error.message)
    }
}

/**
 * Обрабатывает клик по уведомлению для открытия настроек
 * @async
 * @returns {Promise<void>}
 */
async function handleOpenSettingsNotification() {
    await chrome.runtime.openOptionsPage()
}

/**
 * Главный обработчик кликов по уведомлениям
 * Маршрутизирует клик к соответствующему обработчику на основе ID
 * @async
 * @param {string} notificationId - ID уведомления
 * @param {Object} db - База данных
 * @param {Function} openOptionsPageFunc - Функция открытия страницы настроек
 * @returns {Promise<void>}
 */
async function handleNotificationClick(notificationId, db, openOptionsPageFunc) {
    if (notificationId.startsWith('openTab_')) {
        await handleOpenTabNotification(notificationId)
    } else if (notificationId.startsWith('openProject_')) {
        await handleOpenProjectNotification(notificationId, db, openOptionsPageFunc)
    } else if (notificationId.startsWith('openSettings')) {
        await handleOpenSettingsNotification()
    }
}
