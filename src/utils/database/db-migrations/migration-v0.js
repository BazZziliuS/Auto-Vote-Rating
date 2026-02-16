/**
 * Миграция БД версии 0 - начальная инициализация
 */

/**
 * Создает начальную структуру базы данных
 * @async
 * @param {Object} db - База данных
 * @returns {Promise<{settings: Object, generalStats: Object, todayStats: Object, onLine: boolean}>}
 */
async function migrateV0(db) {
    const projects = db.createObjectStore('projects', {autoIncrement: true})
    projects.createIndex('rating, id, nick', ['rating', 'id', 'nick'])
    projects.createIndex('rating, id', ['rating', 'id'])
    projects.createIndex('rating', 'rating')

    const other = db.createObjectStore('other')

    const settings = {
        disabledNotifStart: true,
        disabledNotifInfo: false,
        disabledNotifWarn: false,
        disabledNotifError: false,
        enabledSilentVote: true,
        disabledCheckInternet: false,
        disabledOneVote: false,
        disabledRestartOnTimeout: false,
        disabledFocusedTab: false,
        enableCustom: false,
        timeout: 10000,
        timeoutError: 900000,
        timeoutVote: 900000,
        disabledWarnCaptcha: false,
        debug: false,
        expertMode: false
    }
    await other.add(settings, 'settings')

    const generalStats = {
        successVotes: 0,
        monthSuccessVotes: 0,
        lastMonthSuccessVotes: 0,
        errorVotes: 0,
        laterVotes: 0,
        lastSuccessVote: null,
        lastAttemptVote: null,
        added: Date.now()
    }

    const todayStats = {
        successVotes: 0,
        errorVotes: 0,
        laterVotes: 0,
        lastSuccessVote: null,
        lastAttemptVote: null
    }

    await other.add(generalStats, 'generalStats')
    await other.add(todayStats, 'todayStats')
    await other.add(new Map(), 'openedProjects')

    const onLine = true
    other.add(onLine, 'onLine')

    return {settings, generalStats, todayStats, onLine}
}
