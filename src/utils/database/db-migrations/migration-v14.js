/**
 * Миграция БД версии 14 - блокировка проблемных сайтов
 */

/**
 * Блокирует проекты на проблемных сайтах
 * @async
 * @param {IDBTransaction} transaction - Транзакция БД
 * @returns {Promise<void>}
 */
async function migrateV14(transaction) {
    // Блокировка topcraft.club и topcraft.ru
    let cursor = await transaction.objectStore('projects').index('rating').openCursor('topcraft.club')
    while (cursor) {
        const project = cursor.value
        project.error = chrome.i18n.getMessage('disabledSite', 'Высокий риск быть заблокированным за авто-голосование, голосуйте на данном сайте вручную')
        project.time = Infinity
        await cursor.update(project)
        cursor = await cursor.continue()
        if (!cursor) cursor = await transaction.objectStore('projects').index('rating').openCursor('topcraft.ru')
    }

    // Блокировка mctop.su
    let cursor2 = await transaction.objectStore('projects').index('rating').openCursor('mctop.su')
    while (cursor2) {
        const project = cursor2.value
        project.error = chrome.i18n.getMessage('disabledSite', 'Высокий риск быть заблокированным за авто-голосование, голосуйте на данном сайте вручную')
        project.time = Infinity
        await cursor2.update(project)
        cursor2 = await cursor2.continue()
    }

    // Блокировка monitoringminecraft.ru
    let cursor3 = await transaction.objectStore('projects').index('rating').openCursor('monitoringminecraft.ru')
    while (cursor3) {
        const project = cursor3.value
        project.error = chrome.i18n.getMessage('disabledSite', 'Сайт не работает')
        project.time = Infinity
        await cursor3.update(project)
        cursor3 = await cursor3.continue()
    }
}
