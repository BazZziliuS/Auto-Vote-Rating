/**
 * Утилиты для обновления статистики голосований
 */

/**
 * Обновляет статистику при успешном голосовании
 * @param {Object} project - Объект проекта
 * @param {Object} generalStats - Общая статистика
 * @param {Object} todayStats - Статистика за сегодня
 */
function updateSuccessStats(project, generalStats, todayStats) {
    project.stats.successVotes++
    project.stats.monthSuccessVotes++
    project.stats.lastSuccessVote = Date.now()

    generalStats.successVotes++
    generalStats.monthSuccessVotes++
    generalStats.lastSuccessVote = Date.now()

    todayStats.successVotes++
    todayStats.lastSuccessVote = Date.now()
}

/**
 * Обновляет статистику при отложенном голосовании (already voted)
 * @param {Object} project - Объект проекта
 * @param {Object} generalStats - Общая статистика
 * @param {Object} todayStats - Статистика за сегодня
 */
function updateLaterStats(project, generalStats, todayStats) {
    project.stats.laterVotes++
    generalStats.laterVotes++
    todayStats.laterVotes++
}

/**
 * Обновляет статистику при ошибке голосования
 * @param {Object} project - Объект проекта
 * @param {Object} generalStats - Общая статистика
 * @param {Object} todayStats - Статистика за сегодня
 */
function updateErrorStats(project, generalStats, todayStats) {
    project.stats.errorVotes++
    generalStats.errorVotes++
    todayStats.errorVotes++
}

/**
 * Проверяет и обновляет месячную статистику при смене месяца
 * @param {Object} project - Объект проекта
 */
function checkAndUpdateMonthlyStats(project) {
    const now = new Date()
    const lastAttempt = new Date(project.stats.lastAttemptVote)

    if (lastAttempt.getMonth() < now.getMonth() || lastAttempt.getFullYear() < now.getFullYear()) {
        project.stats.lastMonthSuccessVotes = project.stats.monthSuccessVotes
        project.stats.monthSuccessVotes = 0
    }
    project.stats.lastAttemptVote = Date.now()
}

/**
 * Проверяет и обновляет общую месячную статистику
 * @param {Object} generalStats - Общая статистика
 */
function checkAndUpdateGeneralMonthlyStats(generalStats) {
    const now = new Date()
    const lastAttempt = new Date(generalStats.lastAttemptVote)

    if (lastAttempt.getMonth() < now.getMonth() || lastAttempt.getFullYear() < now.getFullYear()) {
        generalStats.lastMonthSuccessVotes = generalStats.monthSuccessVotes
        generalStats.monthSuccessVotes = 0
    }
    generalStats.lastAttemptVote = Date.now()
}

/**
 * Проверяет и обновляет дневную статистику при смене дня
 * @param {Object} todayStats - Статистика за сегодня
 * @returns {Object} Обновленная или новая статистика за сегодня
 */
function checkAndUpdateDailyStats(todayStats) {
    const now = new Date()
    const lastAttempt = new Date(todayStats.lastAttemptVote)

    if (lastAttempt.getDay() < now.getDay()) {
        return {
            successVotes: 0,
            errorVotes: 0,
            laterVotes: 0,
            lastSuccessVote: null,
            lastAttemptVote: Date.now()
        }
    }
    todayStats.lastAttemptVote = Date.now()
    return todayStats
}

/**
 * Инициализирует статистику перед началом голосования
 * Проверяет и обновляет месячную и дневную статистику
 * @param {Object} project - Объект проекта
 * @param {Object} generalStats - Общая статистика
 * @param {Object} todayStats - Статистика за сегодня
 * @returns {Object} Обновленная статистика за сегодня
 */
function initializeStatsBeforeVote(project, generalStats, todayStats) {
    checkAndUpdateMonthlyStats(project)
    checkAndUpdateGeneralMonthlyStats(generalStats)
    return checkAndUpdateDailyStats(todayStats)
}

/**
 * Сохраняет статистику и проект после завершения голосования
 * @async
 * @param {IDBPDatabase} db - База данных
 * @param {Object} generalStats - Общая статистика
 * @param {Object} todayStats - Статистика за сегодня
 * @param {Object} project - Объект проекта
 * @returns {Promise<void>}
 */
async function saveStatsAndProject(db, generalStats, todayStats, project) {
    await db.put('other', generalStats, 'generalStats')
    await db.put('other', todayStats, 'todayStats')
    await updateStoreValue(db, 'projects', project)
}
