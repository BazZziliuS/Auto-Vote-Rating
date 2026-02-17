// Импорт утилит базы данных (только для Service Worker контекста)
if (typeof WorkerGlobalScope !== 'undefined' && self instanceof WorkerGlobalScope) {
    importScripts('src/utils/database/db-init.js')
    importScripts('src/utils/database/db-migrations/migrations.js')
}

//Настройки
// noinspection ES6ConvertVarToLetConst
var settings
//Общая статистика
// noinspection ES6ConvertVarToLetConst
var generalStats
//Статистика за сегодня
// noinspection ES6ConvertVarToLetConst
var todayStats
//Оновная база данных
// noinspection ES6ConvertVarToLetConst
var db
//База данных логов
// noinspection ES6ConvertVarToLetConst
var dbLogs
//Текущие открытые вкладки расширением
// noinspection ES6ConvertVarToLetConst
var openedProjects = new Map()
let onLine

self.addEventListener('error', (event) => handleUnhandledError(event, dbLogs))
self.addEventListener('unhandledrejection', (event) => handleUnhandledError(event, dbLogs))

//Инициализация настроек расширения
async function initializeConfig(background, version) {
    // Открываем базу данных логов
    if (!dbLogs) {
        dbLogs = await openLogsDatabase()
    }

    // Открываем основную базу данных
    try {
        db = await idb.openDB('avr', version ? version : 15, {
            upgrade: (db, oldVersion, newVersion, transaction) => {
                return runDatabaseUpgrade(db, oldVersion, newVersion, transaction, allProjects, getDomainWithoutSubdomain)
            }
        })
    } catch (error) {
        // На случай если это версия MultiVote
        if (error.name === 'VersionError') {
            if (version) {
                handleDatabaseError({target: {source: {name: 'avr'}, error}}, false, background)
                return
            }
            console.log('Ошибка версии базы данных, возможно вы на версии MultiVote, пытаемся загрузить настройки версии MultiVote')
            await initializeConfig(background, 150)
            return
        }
        handleDatabaseError({target: {source: {name: 'avr'}, error}}, false, background)
        return
    }

    // Устанавливаем обработчики ошибок
    db.onerror = (event) => handleDatabaseError(event, false, background)
    dbLogs.onerror = (event) => handleDatabaseError(event, true, background)

    // Загружаем данные из БД
    const data = await loadDatabaseData(db)
    settings = data.settings
    generalStats = data.generalStats
    todayStats = data.todayStats
    openedProjects = data.openedProjects
    onLine = data.onLine

    if (!background) return

    // Инициализация состояния для background скрипта
    await initializeBackgroundState(state, openedProjects, db, tryCloseTab, checkVote, updateListeners)
}

