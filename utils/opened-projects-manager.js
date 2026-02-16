/**
 * Менеджер для работы с открытыми проектами (openedProjects Map)
 */

/**
 * Создает объект opened проекта
 * @param {Object} project - Объект проекта
 * @param {Object} settings - Настройки расширения
 * @returns {Object} Объект opened с необходимыми полями
 */
function createOpenedProject(project, settings) {
    const opened = {
        key: project.key,
        rating: project.rating,
        countInject: 0
    }

    if (project.randomize) {
        opened.randomize = project.randomize
    }

    if (!settings.disabledRestartOnTimeout) {
        const retryCoolDown = project.randomize
            ? Math.floor(Math.random() * TIME.MAX_RANDOMIZE_COOLDOWN + TIME.MIN_RANDOMIZE_COOLDOWN)
            : (settings.timeoutVote || 900000)

        opened.nextAttempt = Date.now() + retryCoolDown
    }

    return opened
}

/**
 * Очищает временные поля проекта
 * @param {Object} project - Объект проекта
 */
function cleanupProjectTempFields(project) {
    delete project.timeoutQueue
    delete project.nextAttempt
    delete project.countInject
}

/**
 * Проверяет, истек ли timeout для opened проекта
 * @param {Object} openedValue - Значение из openedProjects Map
 * @returns {boolean} true если timeout истек
 */
function isTimeoutExpired(openedValue) {
    return openedValue.timeoutQueue && Date.now() >= openedValue.timeoutQueue
}

/**
 * Проверяет, конфликтует ли проект с уже открытым
 * @param {Object} project - Новый проект
 * @param {Object} openedValue - Значение из openedProjects Map
 * @param {Object} settings - Настройки расширения
 * @returns {boolean} true если есть конфликт
 */
function hasConflict(project, openedValue, settings) {
    return project.rating === openedValue.rating ||
           (openedValue.randomize && project.randomize) ||
           settings.disabledOneVote
}

/**
 * Проверяет, можно ли перезапустить проект
 * @param {string} tabKey - Ключ вкладки
 * @param {Object} openedValue - Значение из openedProjects Map
 * @param {Object} settings - Настройки расширения
 * @returns {boolean} true если можно перезапустить
 */
function canRestart(tabKey, openedValue, settings) {
    if (settings.disabledRestartOnTimeout) return false
    if (tabKey.startsWith?.('queue_')) return false
    if (Date.now() < openedValue.nextAttempt) return false
    return true
}

/**
 * Находит открытый проект по ключу проекта
 * @param {Map} openedProjects - Map открытых проектов
 * @param {number} projectKey - Ключ проекта
 * @returns {{tabKey: string, value: Object}|null} Найденный проект или null
 */
function findOpenedProject(openedProjects, projectKey) {
    for (const [tabKey, value] of openedProjects) {
        if (projectKey === value.key) {
            return {tabKey, value}
        }
    }
    return null
}

/**
 * Создает объект для очереди завершения голосования
 * @param {Object} opened - Открытый проект
 * @param {number} timeout - Базовый timeout
 * @param {Object} project - Объект проекта
 * @returns {Object} Обновленный объект opened
 */
function createQueuedProject(opened, timeout, project) {
    if (project.randomize) {
        timeout += Math.floor(Math.random() * (TIME.MAX_PROJECT_RANDOMIZATION - TIME.MIN_PROJECT_RANDOMIZATION) + TIME.MIN_PROJECT_RANDOMIZATION)
    }

    opened.timeoutQueue = Date.now() + timeout
    delete opened.nextAttempt
    delete opened.countInject

    return opened
}

/**
 * Удаляет истекшие записи из очереди
 * @param {Map} openedProjects - Map открытых проектов
 * @returns {Array<string>} Массив удаленных ключей
 */
function cleanupExpiredQueue(openedProjects) {
    const removed = []
    for (const [tabKey, value] of openedProjects) {
        if (isTimeoutExpired(value)) {
            openedProjects.delete(tabKey)
            removed.push(tabKey)
        }
    }
    return removed
}

/**
 * Обрабатывает конфликты с уже открытыми проектами
 * @async
 * @param {Object} project - Новый проект для голосования
 * @param {Map} openedProjects - Map открытых проектов
 * @param {IDBTransaction} transaction - Транзакция базы данных
 * @param {Object} settings - Настройки расширения
 * @param {IDBPDatabase} db - База данных
 * @returns {Promise<boolean>} true если нужно прервать выполнение
 */
async function handleProjectConflicts(project, openedProjects, transaction, settings, db) {
    for (let [tab, value] of openedProjects) {
        if (hasConflict(project, value, settings)) {
            if (!canRestart(tab, value, settings)) {
                return true // Прерываем выполнение
            }

            // Можем перезапустить - закрываем старый проект
            openedProjects.delete(tab)
            db.put('other', openedProjects, 'openedProjects')

            const projectTimeout = await transaction.objectStore('projects').get(value.key)
            if (!value.nextAttempt) {
                console.warn(getProjectPrefix(projectTimeout, true), 'nextAttempt is undefined, maybe it\'s an error')
            }
            console.warn(getProjectPrefix(projectTimeout, true), chrome.i18n.getMessage('timeout'))
            sendNotification(getProjectPrefix(projectTimeout, false), chrome.i18n.getMessage('timeout'), 'warn', 'openProject_' + project.key)

            if (!settings.disableCloseTabsOnError) {
                tryCloseTab(tab, projectTimeout, 0)
            }
            break
        }
    }

    return false // Продолжаем выполнение
}
