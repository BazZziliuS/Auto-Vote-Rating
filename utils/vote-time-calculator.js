/**
 * Утилиты для вычисления времени следующего голосования
 */

/**
 * Вычисляет время следующего голосования на основе конфигурации проекта
 * @param {Object} project - Объект проекта
 * @param {Object} request - Запрос с результатом голосования
 * @param {Object} allProjects - Объект со всеми конфигурациями проектов
 * @returns {number} Timestamp следующего голосования
 */
function calculateNextVoteTime(project, request, allProjects) {
    let time = new Date()

    // Custom проекты или проекты с собственным timeout
    if (project.rating === 'Custom' || ((project.timeout != null || project.timeoutHour != null) && !Number.isInteger(request.later) && !(project.lastDayMonth && new Date(time.getFullYear(), time.getMonth(), time.getDay() + 1).getMonth() === new Date().getMonth()))) {
        return calculateCustomTimeout(project, time)
    }

    // Проекты с later и числовым значением
    if (request.later && Number.isInteger(request.later)) {
        return calculateLaterTimeout(project, request, time, allProjects)
    }

    // Стандартные проекты с конфигурацией из allProjects
    return calculateStandardTimeout(project, request, time, allProjects)
}

/**
 * Вычисляет timeout для custom проектов
 * @private
 */
function calculateCustomTimeout(project, time) {
    if (project.timeoutHour != null) {
        if (project.timeoutMinute == null) project.timeoutMinute = 0
        if (project.timeoutSecond == null) project.timeoutSecond = 0
        if (project.timeoutMS == null) project.timeoutMS = 0

        let month = time.getMonth()
        let date = time.getDate()

        let needCalculateDate = true
        if (project.timeoutWeek != null) {
            const distance = (project.timeoutWeek + 7 - time.getDay()) % 7
            if (distance > 0) {
                needCalculateDate = false
                date += distance
            }
        } else if (project.timeoutMonth != null) {
            if (time.getDate() !== project.timeoutMonth) {
                needCalculateDate = false
                if (time.getDate() > project.timeoutMonth) month += 1
                date = project.timeoutMonth
            }
        }

        if (needCalculateDate) {
            if (time.getHours() > project.timeoutHour || (time.getHours() === project.timeoutHour && time.getMinutes() >= project.timeoutMinute)) {
                if (project.timeoutWeek != null) {
                    date += 7
                } else if (project.timeoutMonth != null) {
                    month += 1
                    date = project.timeoutMonth
                } else {
                    date += 1
                }
            }
        }

        time = new Date(time.getFullYear(), month, date, project.timeoutHour, project.timeoutMinute, project.timeoutSecond, project.timeoutMS)
    } else {
        time.setUTCMilliseconds(time.getUTCMilliseconds() + project.timeout)
    }

    return time.getTime()
}

/**
 * Вычисляет timeout для проектов с later
 * @private
 */
function calculateLaterTimeout(project, request, time, allProjects) {
    let needSetTime = true
    if (allProjects[project.rating]?.limitedCountVote?.()) {
        project.countVote = project.countVote + 1
        if (project.countVote >= project.maxCountVote) {
            needSetTime = false
            time = new Date(time.getFullYear(), time.getMonth(), time.getDate() + 1, 0, (project.priority ? 0 : 10), 0, 0)
        }
    }
    if (needSetTime) {
        time = new Date(request.later)
    }
    return time.getTime()
}

/**
 * Вычисляет timeout для стандартных проектов
 * @private
 */
function calculateStandardTimeout(project, request, time, allProjects) {
    const timeoutRating = allProjects[project.rating]?.timeout?.(project)

    if (Number.isInteger(request.successfully)) {
        time = new Date(request.successfully)
        return time.getTime()
    }

    if (!timeoutRating) {
        // Если нам не известен таймаут, ставим по умолчанию +24 часа
        time.setUTCDate(time.getUTCDate() + 1)
        return time.getTime()
    }

    if (timeoutRating.week != null) {
        return calculateWeeklyTimeout(project, time, timeoutRating)
    }

    if (timeoutRating.month != null) {
        return calculateMonthlyTimeout(project, time, timeoutRating)
    }

    if (timeoutRating.hour != null) {
        return calculateDailyTimeout(project, time, timeoutRating)
    }

    if (timeoutRating.hours != null) {
        return calculateHourlyTimeout(project, request, time, timeoutRating, allProjects)
    }

    return time.getTime()
}

/**
 * Вычисляет timeout для еженедельного сброса
 * @private
 */
function calculateWeeklyTimeout(project, time, timeoutRating) {
    let date = time.getUTCDate()
    const distance = (timeoutRating.week + 7 - time.getUTCDay()) % 7
    if (distance > 0) {
        date += distance
    } else {
        if (time.getUTCHours() >= timeoutRating.hour) {
            date += 7
        }
    }
    time = new Date(Date.UTC(time.getUTCFullYear(), time.getUTCMonth(), date, timeoutRating.hour, (project.priority ? 0 : 10), 0, 0))
    return time.getTime()
}

/**
 * Вычисляет timeout для ежемесячного сброса
 * @private
 */
function calculateMonthlyTimeout(project, time, timeoutRating) {
    let month = time.getUTCMonth()
    let date = time.getUTCDate()
    if (time.getUTCDate() !== timeoutRating.month) {
        if (time.getUTCDate() > timeoutRating.month) month += 1
        date = timeoutRating.month
    } else {
        if (time.getUTCHours() >= timeoutRating.hour) {
            month += 1
            date = timeoutRating.month
        }
    }
    time = new Date(Date.UTC(time.getUTCFullYear(), month, date, timeoutRating.hour, (project.priority ? 0 : 10), 0, 0))
    return time.getTime()
}

/**
 * Вычисляет timeout для ежедневного сброса
 * @private
 */
function calculateDailyTimeout(project, time, timeoutRating) {
    let date = time.getUTCHours() >= timeoutRating.hour ? time.getUTCDate() + 1 : time.getUTCDate()
    time = new Date(Date.UTC(time.getUTCFullYear(), time.getUTCMonth(), date, timeoutRating.hour, (project.priority ? 0 : 10), 0, 0))
    return time.getTime()
}

/**
 * Вычисляет timeout для почасового сброса
 * @private
 */
function calculateHourlyTimeout(project, request, time, timeoutRating, allProjects) {
    let needSetTime = true
    if (allProjects[project.rating]?.limitedCountVote?.()) {
        project.countVote = project.countVote + 1
        if (project.countVote >= project.maxCountVote) {
            needSetTime = false
            time = new Date(time.getFullYear(), time.getMonth(), time.getDate() + 1, 0, (project.priority ? 0 : 10), 0, 0)
            project.countVote = 0
        }
    }
    if (needSetTime) {
        // Если later=true, используем время последнего успешного голосования вместо текущего
        if (request.later === true && project.stats.lastSuccessVote) {
            time = new Date(project.stats.lastSuccessVote)
        }
        let hours = time.getHours() + timeoutRating.hours
        let minutes = time.getMinutes()
        let seconds = time.getSeconds()
        let milliseconds = time.getMilliseconds()
        if (timeoutRating.minutes != null) minutes += timeoutRating.minutes
        if (timeoutRating.seconds != null) seconds += timeoutRating.seconds
        if (timeoutRating.milliseconds != null) milliseconds += timeoutRating.milliseconds
        time = new Date(time.getFullYear(), time.getMonth(), time.getDate(), hours, minutes, seconds, milliseconds)
    }
    return time.getTime()
}
