/**
 * Утилиты для повторных попыток выполнения операций
 */

/**
 * Выполняет операцию с автоматическим повтором при специфических ошибках
 * @param {Function} operation - Асинхронная функция для выполнения
 * @param {number} maxAttempts - Максимальное количество попыток
 * @param {number} retryDelay - Задержка между попытками (мс)
 * @returns {Promise<*>} Результат операции
 * @throws {Error} Последняя ошибка, если все попытки исчерпаны
 */
async function retryOnTabsLock(operation, maxAttempts = LIMITS.MAX_TAB_OPERATION_RETRIES, retryDelay = TIME.TAB_OPERATION_RETRY_DELAY) {
    let lastError
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
            return await operation()
        } catch (error) {
            lastError = error
            if (error.message === 'Tabs cannot be edited right now (user may be dragging a tab).') {
                if (attempt < maxAttempts - 1) {
                    await wait(retryDelay)
                    continue
                }
            }
            throw error
        }
    }
    throw lastError
}
