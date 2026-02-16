/**
 * Утилиты для работы с уведомлениями
 */

/**
 * Отправляет уведомление пользователю
 * @param {string} title - Заголовок уведомления
 * @param {string} message - Текст уведомления
 * @param {'start'|'info'|'warn'|'error'} type - Тип уведомления
 * @param {string} [notificationId=''] - ID уведомления для обработки клика
 */
function sendNotification(title, message, type, notificationId) {
    if (!message) message = ''
    if (!notificationId) notificationId = ''

    if (settings?.disabledNotifStart && type === 'start') return
    if (settings?.disabledNotifInfo && type === 'info') return

    if (type === 'warn' || type === 'error') {
        (async () => {
            try {
                await chrome.runtime.sendMessage({notification: {title, message, type, notificationId}})
            } catch (error) {
                if (!error.message.includes('Could not establish connection. Receiving end does not exist') && !error.message.includes('The message port closed before a response was received')) {
                    console.warn(error.message)
                }
            }
        })()
    }

    if (settings?.disabledNotifWarn && type === 'warn') return
    if (settings?.disabledNotifError && type === 'error') return

    let notification = {
        type: 'basic',
        iconUrl: 'images/icon128.png',
        title: title,
        message: message
    }
    chrome.notifications.create(notificationId, notification, function () {
    })
}
