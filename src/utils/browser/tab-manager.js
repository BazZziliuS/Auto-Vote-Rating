/**
 * Утилиты для работы с вкладками браузера
 */

/**
 * Открывает новую вкладку с повторными попытками при ошибке
 * @async
 * @param {Object} options - Опции создания вкладки {url, active}
 * @param {Object} project - Объект проекта (для обработки ошибок)
 * @param {number} attempt - Номер текущей попытки
 * @returns {Promise<chrome.tabs.Tab|null>} Созданная вкладка или null при ошибке
 */
async function tryOpenTab(options, project, attempt) {
    try {
        return await chrome.tabs.create(options)
    } catch (error) {
        if (error.message === 'Tabs cannot be edited right now (user may be dragging a tab).' && attempt < LIMITS.MAX_TAB_OPERATION_RETRIES) {
            await wait(TIME.TAB_OPERATION_RETRY_DELAY)
            return await tryOpenTab(options, project, ++attempt)
        }
        endVote({errorOpenTab: error.message}, null, project)
        return null
    }
}

/**
 * Закрывает вкладку с повторными попытками при ошибке
 * @async
 * @param {number} tabId - ID вкладки для закрытия
 * @param {Object} project - Объект проекта (для логирования)
 * @param {number} attempt - Номер текущей попытки
 * @returns {Promise<void>}
 */
async function tryCloseTab(tabId, project, attempt) {
    if (!Number.isInteger(tabId)) return
    try {
        await chrome.tabs.remove(tabId)
    } catch (error) {
        if (error.message === 'Tabs cannot be edited right now (user may be dragging a tab).' && attempt < LIMITS.MAX_TAB_OPERATION_RETRIES) {
            await wait(TIME.TAB_OPERATION_RETRY_DELAY)
            await tryCloseTab(tabId, project, ++attempt)
            return
        }
        if (!error.message.includes('No tab with id')) {
            console.warn(getProjectPrefix(project, true), error.message)
            sendNotification(getProjectPrefix(project, false), error.message, 'error', 'openProject_' + project.key)
        }
    }
}

/**
 * Группирует вкладку с повторными попытками при ошибке
 * @async
 * @param {Object} options - Опции группировки {groupId?, tabIds}
 * @param {number} attempt - Номер текущей попытки
 * @returns {Promise<number>} ID группы вкладок
 * @throws {Error} Если не удалось сгруппировать после всех попыток
 */
async function tryGroupTabs(options, attempt) {
    try {
        return await chrome.tabs.group(options)
    } catch (error) {
        if (error.message === 'Tabs cannot be edited right now (user may be dragging a tab).' && attempt < LIMITS.MAX_TAB_OPERATION_RETRIES) {
            await wait(TIME.TAB_OPERATION_RETRY_DELAY)
            return await tryGroupTabs(options, ++attempt)
        }
        throw error
    }
}

/**
 * Проверяет наличие открытых окон и создает новое если нужно
 * @async
 * @param {Object} project - Объект проекта
 * @returns {Promise<boolean>} true если окно доступно, false при ошибке
 */
async function checkWindow(project) {
    const windows = await chrome.windows.getAll()
        .catch(error => console.warn(chrome.i18n.getMessage('errorOpenTab', error.message)))
    if (!windows?.length) {
        try {
            const window = await chrome.windows.create({focused: false})
            await chrome.windows.update(window.id, {focused: false, drawAttention: false})
        } catch (error) {
            endVote({errorOpenTab: error.message}, null, project)
            return false
        }
    }
    return true
}

/**
 * Группирует вкладку в группу "Auto Vote Rating"
 * @async
 * @param {chrome.tabs.Tab} tab - Вкладка для группировки
 * @param {number|null} groupId - ID существующей группы (если есть)
 * @returns {Promise<number|null>} ID группы или null при ошибке
 */
async function groupTabIntoAutoVoteGroup(tab, groupId) {
    // С начало ищем группу вкладок
    if (groupId == null) {
        const groups = await chrome.tabGroups.query({title: 'Auto Vote Rating'})
        if (groups.length) groupId = groups[0].id
    }

    // Потом пробуем сгруппировать если нашли группу
    if (groupId != null) {
        try {
            await tryGroupTabs({groupId, tabIds: tab.id}, 0)
            return groupId
        } catch (error) {
            if (!error.message.includes('No tab with id') && !error.message.includes('No group with id')) {
                throw error
            }
        }
    }

    // Если мы не нашли групп или не смогли сгруппировать, создаём новую группу
    try {
        groupId = await tryGroupTabs({tabIds: tab.id}, 0)
        await chrome.tabGroups.update(groupId, {color: 'blue', title: 'Auto Vote Rating'})
        return groupId
    } catch (error) {
        if (!error.message.includes('No tab with id') && !error.message.includes('No group with id')) {
            throw error
        }
    }
    return null
}

/**
 * Обрабатывает группировку вкладки с обработкой ошибок
 * @async
 * @param {chrome.tabs.Tab} tab - Вкладка для группировки
 * @param {number} currentGroupId - Текущий ID группы
 * @param {Object} promiseGroup - Промис предыдущей операции группировки
 * @param {Object} project - Объект проекта (для логирования)
 * @param {Function} getMessage - Функция chrome.i18n.getMessage для локализации
 * @returns {Promise<{groupId: number|null, notSupported: boolean}>} Новый groupId и флаг поддержки
 */
async function handleTabGrouping(tab, currentGroupId, promiseGroup, project, getMessage) {
    try {
        await promiseGroup
        const newPromiseGroup = groupTabIntoAutoVoteGroup(tab, currentGroupId)
        const newGroupId = await newPromiseGroup
        return {
            groupId: newGroupId !== null ? newGroupId : currentGroupId,
            notSupported: false,
            promiseGroup: newPromiseGroup
        }
    } catch (error) {
        if (error.message === 'Tabs cannot be edited right now (user may be dragging a tab).') {
            console.warn(getProjectPrefix(project, true), 'Error when grouping tabs,', error.message)
            return {groupId: currentGroupId, notSupported: false, promiseGroup}
        } else {
            console.warn(getMessage('notSupportedGroupTabs'), error.message)
            return {groupId: currentGroupId, notSupported: true, promiseGroup}
        }
    }
}
