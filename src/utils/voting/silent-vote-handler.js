/**
 * Обработчик silent vote (голосование в background без открытия вкладки)
 */

/**
 * Определяет нужно ли использовать silent vote mode для проекта
 * @param {Object} project - Объект проекта
 * @param {Object} allProjects - Объект со всеми конфигурациями проектов
 * @returns {boolean} true если нужен silent vote mode
 */
function shouldUseSilentVote(project, allProjects) {
    if (project.rating === 'Custom') {
        return true
    }

    if (!project.emulateMode && allProjects[project.rating]?.silentVote?.(project)) {
        return true
    }

    return false
}

/**
 * Выполняет silent vote для проекта
 * @async
 * @param {Object} project - Объект проекта
 * @param {Object} silentResponseBody - Объект для хранения тела ответа
 * @returns {Promise<void>}
 */
async function executeSilentVote(project, silentResponseBody) {
    if (!self.DOMParser) {
        importScripts('libs/linkedom.js')
    }

    try {
        // Custom проекты
        if (project.rating === 'Custom') {
            const response = await fetch(project.responseURL, {...project.body})
            await response.text()

            if (response.ok) {
                endVote({successfully: true}, null, project)
            } else {
                endVote({errorVote: [String(response.status), response.url]}, null, project)
            }
            return
        }

        // Динамическая загрузка скрипта silent vote если еще не загружен
        const scriptName = project.ratingMain || project.rating
        if (!self['silentVote_' + scriptName]) {
            importScripts('src/scripts/silentvote/' + scriptName + '_silentvote.js')
        }

        // Выполнение silent vote
        await self['silentVote_' + scriptName](project)

    } catch (error) {
        handleSilentVoteError(error, project, silentResponseBody)
    } finally {
        delete silentResponseBody[project.rating]
    }
}

/**
 * Обрабатывает ошибку silent vote
 * @param {Error} error - Объект ошибки
 * @param {Object} project - Объект проекта
 * @param {Object} silentResponseBody - Объект с телом ответа
 */
function handleSilentVoteError(error, project, silentResponseBody) {
    // Ошибка сети
    if (error.message.includes('Failed to fetch') ||
        error.message.includes('NetworkError when attempting to fetch resource')) {
        endVote({notConnectInternet: true}, null, project)
        return
    }

    // Другие ошибки
    const message = error.stack || error.message
    const request = {errorVoteNoElement: message}

    // Добавляем HTML и URL если есть
    if (silentResponseBody[project.rating]) {
        request.html = silentResponseBody[project.rating].doc.body.outerHTML
        request.url = silentResponseBody[project.rating].url
    }

    endVote(request, null, project)
}

/**
 * Проверяет ответ на ошибки и обрабатывает особые случаи (VK авторизация)
 * @async
 * @param {Object} project - Объект проекта
 * @param {Response} response - Объект Response
 * @param {string} url - URL для проверки
 * @param {Array<number>} [bypassCodes] - Коды статусов для пропуска
 * @param {boolean} [vk=false] - Проверять ли VK авторизацию
 * @param {Object} silentResponseBody - Объект для хранения тела ответа
 * @returns {Promise<boolean>} true если ответ валиден, false если ошибка
 */
async function validateSilentVoteResponse(project, response, url, bypassCodes, vk, silentResponseBody) {
    const host = extractHostname(response.url)

    // Обработка кодировки для VK
    if (vk && (host.includes('vk.com') || host.includes('vk.ru'))) {
        if (response.headers.get('Content-Type')?.includes('windows-1251')) {
            response = await new Response(
                new TextDecoder('windows-1251').decode(await response.arrayBuffer())
            )
        }
    }

    // Парсинг ответа
    response.html = await response.text()
    response.doc = new DOMParser().parseFromString(response.html, 'text/html')

    // Сохранение для отладки
    silentResponseBody[project.rating] = {
        doc: response.doc,
        url: response.url
    }

    // Проверка авторизации VK
    if (vk && (host.includes('vk.com') || host.includes('vk.ru'))) {
        const vkError = extractVKAuthError(response)
        if (vkError) {
            endVote({errorAuthVK: vkError}, null, project)
            return false
        }
    }

    // Проверка редиректа на другой домен
    if (!host.includes(url)) {
        endVote({message: chrome.i18n.getMessage('errorRedirected', response.url)}, null, project)
        return false
    }

    // Проверка bypass кодов
    if (bypassCodes) {
        for (const code of bypassCodes) {
            if (response.status === code) {
                return true
            }
        }
    }

    // Проверка статуса ответа
    if (!response.ok) {
        endVote({errorVote: [String(response.status), response.url]}, null, project)
        return false
    }

    // Проверка statusText
    if (response.statusText &&
        response.statusText !== '' &&
        response.statusText !== 'ok' &&
        response.statusText !== 'OK') {
        endVote({message: response.statusText}, null, project)
        return false
    }

    return true
}

/**
 * Извлекает текст ошибки авторизации VK
 * @param {Response} response - Объект ответа с распарсенным HTML
 * @returns {string|null} Текст ошибки или null
 */
function extractVKAuthError(response) {
    const doc = response.doc

    // Различные варианты ошибок VK
    if (doc.querySelector('div.oauth_form_access')) {
        const accessDiv = doc.querySelector('div.oauth_form_access')
        const itemsDiv = doc.querySelector('div.oauth_access_items')
        return accessDiv.textContent.replace(itemsDiv?.textContent || '', '').trim()
    }

    if (doc.querySelector('div.oauth_content > div')) {
        return doc.querySelector('div.oauth_content > div').textContent
    }

    if (doc.querySelector('#login_blocked_wrap')) {
        const header = doc.querySelector('#login_blocked_wrap div.header').textContent
        const content = doc.querySelector('#login_blocked_wrap div.content').textContent.trim()
        return header + ' ' + content
    }

    if (doc.querySelector('div.login_blocked_panel')) {
        return doc.querySelector('div.login_blocked_panel').textContent.trim()
    }

    if (doc.querySelector('.profile_deleted_text')) {
        return doc.querySelector('.profile_deleted_text').textContent.trim()
    }

    if (response.html.length < 500) {
        return response.html
    }

    return 'null'
}
