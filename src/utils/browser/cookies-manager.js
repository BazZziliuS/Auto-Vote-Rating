/**
 * Менеджер для работы с cookies
 */

/**
 * Очищает все cookies для указанного домена
 * @async
 * @param {string} domain - Домен для очистки cookies (например, '.monitoringminecraft.ru')
 * @param {boolean} debug - Режим отладки
 * @returns {Promise<void>}
 */
async function clearDomainCookies(domain, debug) {
    const cookies = await chrome.cookies.getAll({domain})
    if (debug) console.log(chrome.i18n.getMessage('deletingCookies', domain))

    for (let i = 0; i < cookies.length; i++) {
        if (cookies[i].domain.charAt(0) === '.') {
            cookies[i].domain = cookies[i].domain.substring(1, cookies[i].domain.length)
        }
        await chrome.cookies.remove({
            url: 'https://' + cookies[i].domain + cookies[i].path,
            name: cookies[i].name
        })
    }
}

/**
 * Создаёт промис для очистки cookies для monitoringminecraft.ru
 * @async
 * @param {Object} project - Объект проекта
 * @param {boolean} debug - Режим отладки
 * @returns {Promise<void>}
 */
async function clearMonitoringMinecraftCookies(project, debug) {
    const domain = '.monitoringminecraft.ru'
    await clearDomainCookies(domain, debug)
}
