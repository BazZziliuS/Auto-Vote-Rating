/**
 * Утилиты для обработки результатов голосования
 */

/**
 * Определяет тип результата голосования
 * @param {Object} request - Объект с результатом голосования
 * @returns {'success'|'later'|'error'} Тип результата
 */
function getVoteResultType(request) {
    if (request.successfully) return 'success'
    if (request.later != null) return 'later'
    return 'error'
}

/**
 * Вычисляет cooldown для retry при ошибке
 * @param {Object} request - Объект с результатом голосования
 * @param {Object} project - Объект проекта
 * @param {Object} settings - Настройки расширения
 * @returns {number} Время cooldown в миллисекундах
 */
function calculateErrorCooldown(request, project, settings) {
    if (request.retryCoolDown) {
        return request.retryCoolDown
    }

    if ((request.errorVote && request.errorVote[0] === '404') ||
        (request.message && project.rating === 'wargm.ru' && project.randomize)) {
        return TIME.ERROR_404_COOLDOWN
    }

    if (request.closedTab) {
        return 60000 // 1 минута
    }

    return settings.timeoutError
}

/**
 * Применяет рандомизацию к времени cooldown
 * @param {number} baseCooldown - Базовое время cooldown
 * @param {Object} project - Объект проекта
 * @returns {number} Cooldown с рандомизацией
 */
function applyRandomization(baseCooldown, project) {
    if (project.randomize) {
        return baseCooldown + Math.floor(Math.random() * TIME.MAX_ERROR_RANDOMIZATION)
    }
    return baseCooldown
}

/**
 * Применяет рандомизацию к времени следующего голосования
 * @param {number} baseTime - Базовое время
 * @param {Object} project - Объект проекта
 * @returns {number} Время с рандомизацией
 */
function applyVoteTimeRandomization(baseTime, project) {
    if (project.randomize) {
        if (project.randomize.min == null) {
            project.randomize = {}
            project.randomize.min = 0
            project.randomize.max = 43200000
        }
        return baseTime + Math.floor(Math.random() * (project.randomize.max - project.randomize.min) + project.randomize.min)
    }

    // Рандомизация по умолчанию для TopCraft/McTOP
    if ((project.rating === 'topcraft.ru' || project.rating === 'topcraft.club' ||
         project.rating === 'mctop.su' ||
         (project.rating === 'minecraftrating.ru' && project.listing === 'projects')) &&
        !project.priority && project.timeoutHour == null) {
        return baseTime + Math.floor(Math.random() * (TIME.MAX_RANDOMIZATION_DEFAULT - TIME.MIN_RANDOMIZATION_DEFAULT) + TIME.MIN_RANDOMIZATION_DEFAULT)
    }

    return baseTime
}

/**
 * Форматирует сообщение об ошибке
 * @param {Object} request - Объект с результатом голосования
 * @param {Object} chrome - Chrome API
 * @returns {string} Форматированное сообщение
 */
function formatErrorMessage(request, chrome) {
    if (request.message) {
        return chrome.i18n.getMessage('siteError', request.message)
    }

    const name = Object.keys(request)[0]
    let message

    if (Object.values(request)[0] === true) {
        message = chrome.i18n.getMessage(name)
    } else {
        message = chrome.i18n.getMessage(name, Object.values(request)[0])
    }

    if (request.usedTranslator && name !== 'usedTranslator') {
        message += ' ' + chrome.i18n.getMessage('usedTranslator')
    }

    if (message.length === 0) {
        message = chrome.i18n.getMessage('emptyError')
    }

    if (request.incorrectDomain) {
        message += ' Incorrect domain ' + request.incorrectDomain
    }

    return message
}

/**
 * Форматирует сообщение об успешном голосовании
 * @param {Object} request - Объект с результатом голосования
 * @param {Object} chrome - Chrome API
 * @returns {string} Форматированное сообщение
 */
function formatSuccessMessage(request, chrome) {
    if (typeof request.successfully === 'string') {
        return chrome.i18n.getMessage('successAutoVoteWarn', request.successfully)
    }
    return chrome.i18n.getMessage('successAutoVote')
}

/**
 * Форматирует сообщение о том, что голос уже был подан
 * @param {Object} request - Объект с результатом голосования
 * @param {Object} chrome - Chrome API
 * @returns {string} Форматированное сообщение
 */
function formatLaterMessage(request, chrome) {
    if (typeof request.later === 'string') {
        return chrome.i18n.getMessage('alreadyVotedWarn', request.later)
    }
    return chrome.i18n.getMessage('alreadyVoted')
}

/**
 * Проверяет нужно ли отправлять уведомление об ошибке
 * @param {Object} request - Объект с результатом голосования
 * @returns {boolean} true если нужно отправить уведомление
 */
function shouldNotifyError(request) {
    // Не отправляем уведомление для серверных ошибок 5xx
    if (request.errorVote && request.errorVote[0].charAt(0) === '5') {
        return false
    }
    return true
}
