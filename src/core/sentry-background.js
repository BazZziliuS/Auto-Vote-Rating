/**
 * Sentry Error Monitoring для Service Worker
 * Инициализация мониторинга ошибок в background context
 */

// Функция для загрузки и инициализации Sentry в Service Worker
async function initSentryBackground() {
    try {
        // Импортируем минимальный Sentry client (локальный файл)
        importScripts('/libs/sentry-minimal.js')

        const manifest = chrome.runtime.getManifest()
        const version = manifest.version
        const environment = manifest.version_name || 'production'

        // Инициализация Sentry
        Sentry.init({
            dsn: 'https://af65e911a63f25c10b114b5d73f3d372@o4510900208730112.ingest.de.sentry.io/4510900210761808',

            // Release tracking
            release: `auto-vote-rating@${version}`,
            environment: environment,

            // Sampling rate
            sampleRate: 1.0, // 100% ошибок

            // Фильтрация ошибок
            beforeSend(event, hint) {
                const error = hint.originalException

                if (error && error.message) {
                    const message = error.message.toLowerCase()

                    // Игнорируем известные безвредные ошибки
                    const ignoredPatterns = [
                        'extension context invalidated',
                        'the frame was removed',
                        'the tab was closed',
                        'receiving end does not exist',
                        'could not establish connection',
                        'message port closed',
                        'load failed',
                        'net::err_',
                        'tabs cannot be edited',
                        'no tab with id',
                    ]

                    if (ignoredPatterns.some(pattern => message.includes(pattern))) {
                        return null
                    }
                }

                return event
            },

            ignoreErrors: [
                'Non-Error promise rejection captured',
            ],
        })

        // Устанавливаем контекст
        Sentry.setContext('extension', {
            version: version,
            manifest_version: manifest.manifest_version,
            context: 'service-worker',
        })

        console.log('[Sentry Background] Error monitoring initialized for version', version)

        // Глобальные обработчики устанавливаются автоматически через Sentry.init()

    } catch (error) {
        console.warn('[Sentry Background] Failed to initialize Sentry:', error)
    }
}

// Инициализируем Sentry при загрузке Service Worker
initSentryBackground()
