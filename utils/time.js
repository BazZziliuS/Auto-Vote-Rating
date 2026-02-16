/**
 * Утилиты для работы со временем
 */

/**
 * Ожидает указанное количество миллисекунд
 * @param {number} ms - Количество миллисекунд для ожидания
 * @returns {Promise<void>}
 */
function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
}
