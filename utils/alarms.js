/**
 * Утилиты для работы с chrome.alarms
 */

/**
 * Безопасно создает alarm с учетом минимальной задержки
 * @async
 * @param {string} name - Имя алярма
 * @param {number} when - Временная метка запуска (timestamp)
 * @param {Object} project - Объект проекта (для логирования)
 * @returns {Promise<boolean>} true если алярм создан успешно
 */
async function createSafeAlarm(name, when, project) {
    if (when - Date.now() < TIME.MIN_ALARM_DELAY) {
        when = Date.now() + TIME.MIN_ALARM_DELAY
    }
    try {
        await chrome.alarms.create(name, {when})
        return true
    } catch (error) {
        if (project) {
            console.warn(getProjectPrefix(project, true), 'Ошибка при создании chrome.alarms', error.message)
        } else {
            console.warn('Ошибка при создании chrome.alarms', name, error.message)
        }
        return false
    }
}

/**
 * Проверяет существование алярма с данной временной меткой
 * @async
 * @param {number} scheduledTime - Временная метка для поиска
 * @returns {Promise<boolean>} true если алярм с такой меткой существует
 */
async function hasAlarmWithTime(scheduledTime) {
    const alarms = await chrome.alarms.getAll()
    for (const alarm of alarms) {
        if (alarm.scheduledTime === scheduledTime) {
            return true
        }
    }
    return false
}

/**
 * Планирует alarm для проекта после завершения голосования
 * Очищает старый nextAttempt alarm и создает новый alarm на project.time
 * @async
 * @param {Object} project - Объект проекта
 * @returns {Promise<void>}
 */
async function scheduleProjectAlarm(project) {
    await chrome.alarms.clear('nextAttempt_' + project.key)

    if (project.time == null || project.time <= Date.now()) {
        return
    }

    let when = project.time
    if (when - Date.now() < TIME.MIN_ALARM_DELAY) {
        when = Date.now() + TIME.MIN_ALARM_DELAY
    }

    // Проверяем существование alarm с таким же временем и числовым именем
    const alarms = await chrome.alarms.getAll()
    for (const alarm of alarms) {
        if (!isNaN(alarm.name) && alarm.scheduledTime === when) {
            return // Alarm уже существует
        }
    }

    // Создаем новый alarm
    await createSafeAlarm(String(project.key), when, project)
}
