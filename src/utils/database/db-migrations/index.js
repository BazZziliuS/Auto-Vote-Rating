/**
 * Главная функция миграции базы данных
 * Координирует выполнение всех миграций
 */

/**
 * Выполняет миграцию базы данных
 * @async
 * @param {Object} db - База данных
 * @param {number} oldVersion - Старая версия БД
 * @param {number} newVersion - Новая версия БД
 * @param {IDBTransaction} transaction - Транзакция БД
 * @param {Object} allProjects - Конфигурации всех проектов
 * @param {Function} getDomainWithoutSubdomain - Функция получения домена
 * @returns {Promise<{settings: Object, generalStats: Object, todayStats: Object, onLine: boolean}>}
 */
async function runDatabaseUpgrade(db, oldVersion, newVersion, transaction, allProjects, getDomainWithoutSubdomain) {
    if (oldVersion == null) oldVersion = 1

    if (oldVersion !== newVersion) {
        if (self.createNotif) {
            // noinspection ES6MissingAwait
            createNotif(chrome.i18n.getMessage('oldSettings', [oldVersion, newVersion]), 'hint')
        } else {
            console.log(chrome.i18n.getMessage('oldSettings', [oldVersion, newVersion]))
        }
    }

    let result = {}

    // Начальная инициализация (версия 0)
    if (oldVersion === 0) {
        result = await migrateV0(db)
        return result
    }

    // Создание транзакции если не передана
    if (!transaction) transaction = db.transaction(['projects', 'other'], 'readwrite')

    // Миграции версий 1-12
    if (oldVersion <= 1) {
        result.todayStats = await migrateV1(transaction)
    }

    if (oldVersion <= 3) {
        await migrateV3(transaction)
    }

    if (oldVersion <= 4) {
        await migrateV4(transaction)
    }

    if (oldVersion <= 7) {
        await migrateV7(transaction)
    }

    if (oldVersion <= 8) {
        await migrateV8(transaction)
    }

    if (oldVersion <= 9) {
        result.openedProjects = await migrateV9(transaction)
    }

    if (oldVersion <= 10) {
        await migrateV10(transaction)
    }

    if (oldVersion <= 11) {
        result.onLine = await migrateV11(transaction)
    }

    if (oldVersion <= 12) {
        await migrateV12(transaction)
    }

    // Большая миграция v13
    if (oldVersion <= 13) {
        await migrateV13(transaction, allProjects, getDomainWithoutSubdomain)
    }

    // Миграция v14
    if (oldVersion <= 14) {
        await migrateV14(transaction)
    }

    // Проверка и создание todayStats если отсутствует
    if (!result.todayStats) {
        const other = transaction.objectStore('other')
        const todayStats = {
            successVotes: 0,
            errorVotes: 0,
            laterVotes: 0,
            lastSuccessVote: null,
            lastAttemptVote: null
        }
        await other.put(todayStats, 'todayStats')
        result.todayStats = todayStats
    }

    // Проверка и создание generalStats если отсутствует
    if (!result.generalStats) {
        const other = transaction.objectStore('other')
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
        await other.put(generalStats, 'generalStats')
        result.generalStats = generalStats
    }

    return result
}
