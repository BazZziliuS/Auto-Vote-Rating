/**
 * Sentry Error Monitoring Initialization
 * Инициализация мониторинга ошибок через Sentry
 */

// Проверяем, что Sentry загружен
if (typeof Sentry !== 'undefined') {
    // Определяем окружение
    const environment = chrome.runtime.getManifest().version_name || 'production'
    const version = chrome.runtime.getManifest().version

    // Инициализация Sentry
    Sentry.init({
        dsn: 'https://af65e911a63f25c10b114b5d73f3d372@o4508675969376256.ingest.de.sentry.io/4508675974160464',

        // Release tracking
        release: `auto-vote-rating@${version}`,
        environment: environment,

        // Sampling rate (минимальная версия поддерживает только базовый sampling)
        sampleRate: 1.0, // 100% ошибок (можно снизить для production)

        // Фильтрация ошибок
        beforeSend(event, hint) {
            // Игнорируем известные безвредные ошибки
            const error = hint.originalException

            // Игнорируем ошибки расширений браузера
            if (error && error.message) {
                const message = error.message.toLowerCase()

                // Список игнорируемых паттернов
                const ignoredPatterns = [
                    'extension context invalidated',
                    'the frame was removed',
                    'the tab was closed',
                    'receiving end does not exist',
                    'could not establish connection',
                    'message port closed',
                    'load failed', // Сетевые ошибки
                    'net::err_', // Сетевые ошибки Chrome
                ]

                if (ignoredPatterns.some(pattern => message.includes(pattern))) {
                    return null // Не отправляем в Sentry
                }
            }

            return event
        },

        // Игнорирование определённых URL
        ignoreErrors: [
            'Non-Error promise rejection captured',
            'ResizeObserver loop limit exceeded',
            'ResizeObserver loop completed with undelivered notifications',
        ],
    })

    // Устанавливаем пользовательский контекст
    Sentry.setContext('extension', {
        version: version,
        browser: navigator.userAgent,
        manifest_version: chrome.runtime.getManifest().manifest_version,
    })

    console.log('[Sentry] Error monitoring initialized for version', version)
} else {
    console.warn('[Sentry] Sentry SDK not loaded, error monitoring disabled')
}
