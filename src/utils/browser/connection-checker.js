/**
 * Утилиты для проверки интернет-соединения
 */

/**
 * Проверяет доступность интернета и обрабатывает состояние offline
 * @async
 * @param {Object} project - Объект проекта
 * @param {Object} settings - Настройки расширения
 * @param {Object} db - База данных
 * @param {boolean} onLine - Текущий статус соединения
 * @returns {Promise<{shouldReturn: boolean, newOnLineStatus: boolean|null}>}
 *          shouldReturn: true если нужно прервать выполнение
 *          newOnLineStatus: новый статус или null если не изменился
 */
async function checkInternetConnection(project, settings, db, onLine) {
    // Если проверка интернета отключена
    if (settings.disabledCheckInternet) {
        return {shouldReturn: false, newOnLineStatus: null}
    }

    // Если браузер сообщает что нет соединения, но мы думали что оно есть
    if (!navigator.onLine && onLine) {
        // TODO к сожалению в Service Worker отсутствует слушатель на восстановление соединения с интернетом, у нас остаётся только 1 вариант, это попытаться снова запустить checkVote через минуту
        await createSafeAlarm('checkVote', Date.now() + TIME.MIN_ALARM_DELAY, null)

        sendNotification(getProjectPrefix(project, false), chrome.i18n.getMessage('internetDisconnected'), 'error', 'openProject_' + project.key)
        console.warn(getProjectPrefix(project, true), chrome.i18n.getMessage('internetDisconnected'))

        db.put('other', false, 'onLine')
        return {shouldReturn: true, newOnLineStatus: false}
    }

    // Если мы знаем что соединения нет
    if (!onLine) {
        return {shouldReturn: true, newOnLineStatus: null}
    }

    return {shouldReturn: false, newOnLineStatus: null}
}

/**
 * Проверяет восстановление интернет-соединения в checkVote
 * @async
 * @param {Object} settings - Настройки расширения
 * @param {Object} db - База данных
 * @param {boolean} onLine - Текущий статус соединения
 * @returns {Promise<{shouldReturn: boolean, newOnLineStatus: boolean|null}>}
 *          shouldReturn: true если нужно прервать выполнение
 *          newOnLineStatus: новый статус или null если не изменился
 */
async function checkInternetRestoration(settings, db, onLine) {
    // Если проверка интернета отключена или соединение есть
    if (settings.disabledCheckInternet || onLine) {
        return {shouldReturn: false, newOnLineStatus: null}
    }

    // Проверяем, восстановилось ли соединение
    if (navigator.onLine) {
        console.log(chrome.i18n.getMessage('internetRestored'))
        db.put('other', true, 'onLine')
        return {shouldReturn: false, newOnLineStatus: true}
    }

    // Соединения по-прежнему нет, планируем повторную проверку
    // TODO к сожалению в Service Worker отсутствует слушатель на восстановление соединения с интернетом, у нас остаётся только 1 вариант, это попытаться снова запустить checkVote через минуту
    await createSafeAlarm('checkVote', Date.now() + TIME.MIN_ALARM_DELAY, null)
    return {shouldReturn: true, newOnLineStatus: null}
}
