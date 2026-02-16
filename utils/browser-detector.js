/**
 * Утилиты для определения браузера
 */

/**
 * Проверяет является ли браузер Opera и нужно ли прервать выполнение
 * @param {Object} settings - Настройки расширения
 * @returns {boolean} true если нужно прервать выполнение (Opera без внимания)
 */
function shouldSkipForOpera(settings) {
    if (settings.operaAttention2) {
        return false // Пользователь подтвердил использование Opera
    }

    // Проверка различными методами, является ли браузер Opera
    const isOpera =
        navigator?.userAgentData?.brands?.[0]?.brand === 'Opera' ||
        (!!self.opr && !!opr.addons) ||
        !!self.opera ||
        navigator.userAgent.indexOf(' OPR/') >= 0

    return isOpera
}
