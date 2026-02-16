/**
 * Миграции БД версий 1-12
 * Простые миграции для обновления настроек и добавления полей в проекты
 */

/**
 * Миграция v1 - добавление todayStats и timeout
 * @async
 * @param {IDBTransaction} transaction - Транзакция БД
 * @returns {Promise<Object>} todayStats
 */
async function migrateV1(transaction) {
    const todayStats = {
        successVotes: 0,
        errorVotes: 0,
        laterVotes: 0,
        lastSuccessVote: null,
        lastAttemptVote: null
    }
    const store = transaction.objectStore('other')
    await store.put(todayStats, 'todayStats')

    const settings = await store.get('settings')
    settings.timeout = 10000
    await store.put(settings, 'settings')

    return todayStats
}

/**
 * Миграция v3 - добавление поля game для проектов
 * @async
 * @param {IDBTransaction} transaction - Транзакция БД
 * @returns {Promise<void>}
 */
async function migrateV3(transaction) {
    const store = transaction.objectStore('projects')

    // DiscordBotList
    let cursor = await store.index('rating').openCursor('DiscordBotList')
    while (cursor) {
        const project = cursor.value
        project.game = 'bots'
        await cursor.update(project)
        cursor = await cursor.continue()
    }

    // MinecraftRating
    cursor = await store.index('rating').openCursor('MinecraftRating')
    while (cursor) {
        const project = cursor.value
        project.game = 'projects'
        await cursor.update(project)
        cursor = await cursor.continue()
    }

    // PixelmonServers
    cursor = await store.index('rating').openCursor('PixelmonServers')
    while (cursor) {
        const project = cursor.value
        project.game = 'pixelmonservers.com'
        project.rating = 'MineServers'
        await cursor.update(project)
        cursor = await cursor.continue()
    }
}

/**
 * Миграция v4 - добавление maxCountVote и countVote
 * @async
 * @param {IDBTransaction} transaction - Транзакция БД
 * @returns {Promise<void>}
 */
async function migrateV4(transaction) {
    const store = transaction.objectStore('projects')
    const ratings = ['MCServerList', 'CzechCraft', 'MinecraftServery']

    for (const rating of ratings) {
        let cursor = await store.index('rating').openCursor(rating)
        while (cursor) {
            const project = cursor.value
            project.maxCountVote = 5
            project.countVote = 0
            await cursor.update(project)
            cursor = await cursor.continue()
        }
    }
}

/**
 * Миграция v7 - добавление timeoutError, disabledOneVote, disabledFocusedTab
 * @async
 * @param {IDBTransaction} transaction - Транзакция БД
 * @returns {Promise<void>}
 */
async function migrateV7(transaction) {
    const settings = await transaction.objectStore('other').get('settings')
    settings.timeoutError = 900000
    settings.disabledOneVote = false
    settings.disabledFocusedTab = false
    await transaction.objectStore('other').put(settings, 'settings')
}

/**
 * Миграция v8 - добавление randomize для WARGM
 * @async
 * @param {IDBTransaction} transaction - Транзакция БД
 * @returns {Promise<void>}
 */
async function migrateV8(transaction) {
    const store = transaction.objectStore('projects')
    let cursor = await store.index('rating').openCursor('WARGM')
    while (cursor) {
        const project = cursor.value
        project.randomize = {min: 0, max: 14400000}
        await cursor.update(project)
        cursor = await cursor.continue()
    }
}

/**
 * Миграция v9 - создание openedProjects Map
 * @async
 * @param {IDBTransaction} transaction - Транзакция БД
 * @returns {Promise<Map>} openedProjects
 */
async function migrateV9(transaction) {
    const openedProjects = new Map()
    await transaction.objectStore('other').put(openedProjects, 'openedProjects')
    return openedProjects
}

/**
 * Миграция v10 - добавление timeoutVote
 * @async
 * @param {IDBTransaction} transaction - Транзакция БД
 * @returns {Promise<void>}
 */
async function migrateV10(transaction) {
    const settings = await transaction.objectStore('other').get('settings')
    settings.timeoutVote = 900000
    await transaction.objectStore('other').put(settings, 'settings')
}

/**
 * Миграция v11 - добавление onLine
 * @async
 * @param {IDBTransaction} transaction - Транзакция БД
 * @returns {Promise<boolean>} onLine
 */
async function migrateV11(transaction) {
    const onLine = true
    await transaction.objectStore('other').put(onLine, 'onLine')
    return onLine
}

/**
 * Миграция v12 - добавление randomize для CraftList
 * @async
 * @param {IDBTransaction} transaction - Транзакция БД
 * @returns {Promise<void>}
 */
async function migrateV12(transaction) {
    const store = transaction.objectStore('projects')
    let cursor = await store.index('rating').openCursor('CraftList')
    while (cursor) {
        const project = cursor.value
        project.randomize = {min: 0, max: 3600000}
        await cursor.update(project)
        cursor = await cursor.continue()
    }
}
