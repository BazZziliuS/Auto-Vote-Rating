/**
 * Утилиты для инициализации базы данных
 */

/**
 * Обрабатывает необработанные ошибки и rejection'ы
 * @param {Event} event - Событие ошибки
 * @param {Object} dbLogs - База данных логов
 */
function handleUnhandledError(event, dbLogs) {
    let error
    if (event.reason) {
        error = event.reason
    } else if (event.error) {
        error = event.error
    } else {
        error = 'Unidentified error, see the details in the console '
        if (console._error) console._error(event)
        else console.error(event)
        error += JSON.stringify(event)
    }

    if (self.createNotif) {
        // noinspection JSIgnoredPromiseFromCall
        createNotif(error, 'error', {dontLog: true})
        document.querySelectorAll('button[disabled]').forEach((el) => el.disabled = false)
    }

    if (!dbLogs) return

    const time = new Date().toLocaleString().replace(',', '')
    if (error.stack) error = error.stack
    const log = '[' + time + ' ERROR]: ' + error
    try {
        dbLogs.put('logs', log).catch(e => {
            if (console._error) console._error(e)
            else console.error(e)
        })
    } catch (e) {
        if (console._error) console._error(e)
        else console.error(e)
    }
}

/**
 * Обрабатывает ошибки базы данных
 * @param {Event} event - Событие ошибки БД
 * @param {boolean} logs - Является ли это БД логов
 * @param {boolean} background - Выполняется ли в background
 */
function handleDatabaseError(event, logs, background) {
    if (background) {
        sendNotification(
            chrome.i18n.getMessage('errordbTitle', event.target.source.name),
            event.target.error.message,
            'error',
            'openSettings'
        )
        if (logs) {
            console._error(chrome.i18n.getMessage('errordb', [event.target.source.name, event.target.error.message]))
        } else {
            console.error(chrome.i18n.getMessage('errordb', [event.target.source.name, event.target.error.message]))
        }
    } else {
        createNotif(
            chrome.i18n.getMessage('errordb', [event.target.source.name, event.target.error.message]),
            'error'
        )
    }
}

/**
 * Открывает базу данных логов
 * @async
 * @returns {Promise<Object>} База данных логов
 */
async function openLogsDatabase() {
    return await idb.openDB('logs', 1, {
        upgrade(db) {
            db.createObjectStore('logs', {autoIncrement: true})
        }
    })
}

/**
 * Загружает данные из базы данных
 * @async
 * @param {Object} db - База данных
 * @returns {Promise<Object>} Объект с настройками и статистикой
 */
async function loadDatabaseData(db) {
    return {
        settings: await db.get('other', 'settings'),
        generalStats: await db.get('other', 'generalStats'),
        todayStats: await db.get('other', 'todayStats'),
        openedProjects: await db.get('other', 'openedProjects'),
        onLine: await db.get('other', 'onLine')
    }
}

/**
 * Инициализирует состояние для background скрипта
 * @async
 * @param {Object} state - Состояние service worker
 * @param {Object} openedProjects - Map открытых проектов
 * @param {Object} db - База данных
 * @param {Function} tryCloseTab - Функция закрытия вкладки
 * @param {Function} checkVote - Функция проверки голосования
 * @param {Function} updateListeners - Функция обновления listeners
 * @returns {Promise<void>}
 */
async function initializeBackgroundState(state, openedProjects, db, tryCloseTab, checkVote, updateListeners) {
    if (state !== 'activated') {
        console.log(chrome.i18n.getMessage('start', chrome.runtime.getManifest().version))

        if (openedProjects.size > 0) {
            for (const [key, value] of openedProjects) {
                openedProjects.delete(key)
                // noinspection ES6MissingAwait
                tryCloseTab(key, value, 0)
            }
            await db.put('other', openedProjects, 'openedProjects')
        }

        // noinspection ES6MissingAwait
        checkVote()
    } else {
        if (!openedProjects.size) {
            updateListeners(false)
        }
    }
}
