/**
 * Утилиты для проверки и сопоставления URL
 */

/**
 * Проверяет является ли URL авторизационным (не требует инъекции скриптов)
 * @param {string} url - URL для проверки
 * @returns {boolean} true если это авторизационный URL
 */
function isAuthUrl(url) {
    return url.match(/facebook.com\/*/) ||
           url.match(/google.com\/*/) ||
           url.match(/accounts.google.com\/*/) ||
           url.match(/reddit.com\/*/) ||
           url.match(/twitter.com\/*/)
}

/**
 * Проверяет является ли URL капчей
 * @param {string} url - URL для проверки
 * @returns {boolean} true если это URL капчи
 */
function isCaptchaUrl(url) {
    return url.match(/hcaptcha.com\/captcha\/*/) ||
           url.includes('smartcaptcha.yandexcloud.net') ||
           url.includes('service.mtcaptcha.com') ||
           url.match(/https?:\/\/(.+?\.)?google.com\/recaptcha\/api.\/anchor*/) ||
           url.match(/https?:\/\/(.+?\.)?google.com\/recaptcha\/api.\/bframe*/) ||
           url.match(/https?:\/\/(.+?\.)?recaptcha.net\/recaptcha\/api.\/anchor*/) ||
           url.match(/https?:\/\/(.+?\.)?recaptcha.net\/recaptcha\/api.\/bframe*/) ||
           url.match(/https?:\/\/(.+?\.)?google.com\/recaptcha\/api\/fallback*/) ||
           url.match(/https?:\/\/(.+?\.)?recaptcha.net\/recaptcha\/api\/fallback*/) ||
           url.match(/https?:\/\/(.+?\.)?recaptcha.net\/recaptcha\/enterprise\/fallback*/) ||
           url.match(/https?:\/\/(.+?\.)?google.com\/recaptcha\/enterprise\/anchor*/) ||
           url.match(/https?:\/\/(.+?\.)?recaptcha.net\/recaptcha\/enterprise\/bframe*/) ||
           url.match(/https?:\/\/(.+?\.)?service\.mtcaptcha\.com\/mtcv1/) ||
           url.match(/https:\/\/challenges.cloudflare.com\/*/)
}

/**
 * Проверяет является ли URL простой капчей для committed listener
 * (меньше проверок чем в isCaptchaUrl)
 * @param {string} url - URL для проверки
 * @returns {boolean} true если это URL капчи
 */
function isCaptchaUrlForCommitted(url) {
    return url.match(/hcaptcha.com\/captcha\/*/) ||
           url.match(/https?:\/\/(.+?\.)?google.com\/recaptcha\/api.\/anchor*/) ||
           url.match(/https?:\/\/(.+?\.)?google.com\/recaptcha\/api.\/bframe*/) ||
           url.match(/https?:\/\/(.+?\.)?recaptcha.net\/recaptcha\/api.\/anchor*/) ||
           url.match(/https?:\/\/(.+?\.)?recaptcha.net\/recaptcha\/api.\/bframe*/) ||
           url.match(/https?:\/\/(.+?\.)?google.com\/recaptcha\/api\/fallback*/) ||
           url.match(/https?:\/\/(.+?\.)?recaptcha.net\/recaptcha\/api\/fallback*/) ||
           url.match(/https?:\/\/(.+?\.)?recaptcha.net\/recaptcha\/enterprise\/fallback*/) ||
           url.match(/https?:\/\/(.+?\.)?google.com\/recaptcha\/enterprise\/anchor*/) ||
           url.match(/https?:\/\/(.+?\.)?recaptcha.net\/recaptcha\/enterprise\/bframe*/) ||
           url.match(/https:\/\/challenges.cloudflare.com\/*/)
}

/**
 * Проверяет является ли URL главным captcha или recaptcha доменом (для проверок ошибок)
 * @param {string} url - URL для проверки
 * @returns {boolean} true если это домен капчи
 */
function isCaptchaDomain(url) {
    return url.match(/hcaptcha.com\/captcha\/*/) ||
           url.match(/https?:\/\/(.+?\.)?google.com\/recaptcha\/*/) ||
           url.match(/https?:\/\/(.+?\.)?recaptcha.net\/recaptcha\/*/) ||
           url.match(/https:\/\/challenges.cloudflare.com\/*/)
}

/**
 * Проверяет является ли ошибка игнорируемой сетевой ошибкой
 * @param {string} errorMessage - Сообщение об ошибке
 * @returns {boolean} true если ошибку нужно игнорировать
 */
function isIgnorableNetworkError(errorMessage) {
    // Chrome errors
    if (errorMessage.includes('net::ERR_ABORTED') ||
        errorMessage.includes('net::ERR_CONNECTION_RESET') ||
        errorMessage.includes('net::ERR_NETWORK_CHANGED') ||
        errorMessage.includes('net::ERR_CACHE_MISS') ||
        errorMessage.includes('net::ERR_BLOCKED_BY_CLIENT')) {
        return true
    }

    // Chrome QUIC error (только в webRequest)
    if (errorMessage.includes('net::ERR_QUIC_PROTOCOL_ERROR')) {
        return true
    }

    // FireFox errors
    if (errorMessage.includes('NS_BINDING_ABORTED') ||
        errorMessage.includes('NS_ERROR_NET_ON_RESOLVED') ||
        errorMessage.includes('NS_ERROR_NET_ON_RESOLVING') ||
        errorMessage.includes('NS_ERROR_NET_ON_WAITING_FOR') ||
        errorMessage.includes('NS_ERROR_NET_ON_CONNECTING_TO') ||
        errorMessage.includes('NS_ERROR_FAILURE') ||
        errorMessage.includes('NS_ERROR_DOCSHELL_DYING') ||
        errorMessage.includes('NS_ERROR_NET_ON_TRANSACTION_CLOSE')) {
        return true
    }

    return false
}
