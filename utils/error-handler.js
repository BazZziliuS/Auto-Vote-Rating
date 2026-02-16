/**
 * Обработчик ошибок вкладок и инъекции скриптов
 */

/**
 * Обрабатывает ошибку, возникшую при работе со вкладкой
 * @async
 * @param {Error} error - Объект ошибки
 * @param {Object} project - Объект проекта
 * @param {IDBPDatabase} db - База данных
 * @returns {Promise<void>}
 */
async function catchTabError(error, project, db) {
    // Игнорируемые ошибки
    const ignoredErrors = [
        'The frame was removed.',
        'No frame with id',
        'The tab was closed.',
        'PrecompiledScript.executeInGlobal', // FireFox
        'Could not establish connection. Receiving end does not exist',
        'The message port closed before a response was received',
        'Frame with ID',
        'was removed'
    ]

    // Проверяем, не является ли ошибка игнорируемой
    for (const ignoredError of ignoredErrors) {
        if (error.message.includes(ignoredError)) {
            return
        }
    }

    // Получаем актуальные данные проекта из базы
    project = await db.get('projects', project.key)

    // Формируем сообщение об ошибке
    let message = error.message

    // Добавляем ссылку на решение для политик ExtensionsSettings
    if (message.includes('This page cannot be scripted due to an ExtensionsSettings policy')) {
        message += ' Try this solution: https://github.com/Serega007RU/Auto-Vote-Rating/wiki/Problems-with-Opera'
    }

    // Логируем и отправляем уведомление
    console.error(getProjectPrefix(project, true), error.message)
    sendNotification(getProjectPrefix(project, false), error.message, 'error', 'openProject_' + project.key)

    // Сохраняем ошибку в проекте
    project.error = message
    await updateStoreValue(db, 'projects', project)
}
