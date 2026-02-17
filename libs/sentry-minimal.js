/**
 * Minimal Sentry Client for Chrome Extensions
 * Работает без внешних зависимостей, отправляет ошибки через Sentry API
 */

(function(global) {
    'use strict';

    const SENTRY_DSN = 'https://af65e911a63f25c10b114b5d73f3d372@o4510900208730112.ingest.de.sentry.io/4510900210761808'
    const SENTRY_ENDPOINT = 'https://o4510900208730112.ingest.de.sentry.io/api/4510900210761808/store/'

    // Парсим DSN
    function parseDSN(dsn) {
        const match = dsn.match(/https:\/\/(.+)@(.+?)\/(.+)/)
        return {
            publicKey: match[1],
            host: match[2],
            projectId: match[3]
        }
    }

    const dsnParts = parseDSN(SENTRY_DSN)

    // Debug: показываем распарсенный DSN
    console.log('[Sentry Debug] DSN parsed:', {
        publicKey: dsnParts.publicKey,
        host: dsnParts.host,
        projectId: dsnParts.projectId,
        fullURL: `https://${dsnParts.host}/api/${dsnParts.projectId}/store/`
    })

    class SentryClient {
        constructor(options = {}) {
            this.options = {
                dsn: SENTRY_DSN,
                release: options.release || 'unknown',
                environment: options.environment || 'production',
                sampleRate: options.sampleRate || 1.0,
                beforeSend: options.beforeSend || null,
                ignoreErrors: options.ignoreErrors || [],
                ...options
            }

            this.context = {}
            this.user = null
        }

        /**
         * Устанавливает контекст
         */
        setContext(key, value) {
            this.context[key] = value
        }

        /**
         * Устанавливает пользователя
         */
        setUser(user) {
            this.user = user
        }

        /**
         * Отправляет исключение в Sentry
         */
        captureException(error, hint = {}) {
            // Проверяем sampling rate
            if (Math.random() > this.options.sampleRate) {
                return null
            }

            // Проверяем игнорируемые ошибки
            const errorMessage = error?.message || String(error)
            if (this.options.ignoreErrors.some(pattern =>
                errorMessage.toLowerCase().includes(pattern.toLowerCase())
            )) {
                return null
            }

            const event = this._prepareEvent(error, hint)

            // beforeSend callback
            if (this.options.beforeSend) {
                const filteredEvent = this.options.beforeSend(event, hint)
                if (!filteredEvent) return null
            }

            return this._sendEvent(event)
        }

        /**
         * Отправляет сообщение в Sentry
         */
        captureMessage(message, level = 'info') {
            const event = {
                message: message,
                level: level,
                timestamp: Date.now() / 1000,
                platform: 'javascript',
                release: this.options.release,
                environment: this.options.environment,
                contexts: this.context,
                user: this.user
            }

            return this._sendEvent(event)
        }

        /**
         * Подготавливает событие для отправки
         */
        _prepareEvent(error, hint) {
            const stack = this._parseStackTrace(error)

            return {
                exception: {
                    values: [{
                        type: error.name || 'Error',
                        value: error.message || String(error),
                        stacktrace: {
                            frames: stack
                        }
                    }]
                },
                level: 'error',
                timestamp: Date.now() / 1000,
                platform: 'javascript',
                release: this.options.release,
                environment: this.options.environment,
                contexts: this.context,
                user: this.user,
                tags: {
                    ...(hint.tags || {})
                }
            }
        }

        /**
         * Парсит stack trace
         */
        _parseStackTrace(error) {
            if (!error.stack) return []

            const lines = error.stack.split('\n').slice(1) // Пропускаем первую строку
            const frames = []

            for (const line of lines) {
                const match = line.match(/at\s+(.+?)\s+\((.+?):(\d+):(\d+)\)/) ||
                             line.match(/at\s+(.+?):(\d+):(\d+)/)

                if (match) {
                    frames.push({
                        filename: match[2] || match[1],
                        function: match[1] || '<anonymous>',
                        lineno: parseInt(match[3] || match[2]),
                        colno: parseInt(match[4] || match[3])
                    })
                }
            }

            return frames.reverse() // Sentry ожидает обратный порядок
        }

        /**
         * Отправляет событие в Sentry
         */
        async _sendEvent(event) {
            const sentryKey = dsnParts.publicKey
            const sentryUrl = `https://${dsnParts.host}/api/${dsnParts.projectId}/store/`

            const headers = {
                'Content-Type': 'application/json',
                'X-Sentry-Auth': `Sentry sentry_version=7, sentry_key=${sentryKey}, sentry_client=sentry-minimal/1.0.0`
            }

            try {
                const response = await fetch(sentryUrl, {
                    method: 'POST',
                    headers: headers,
                    body: JSON.stringify(event)
                })

                if (!response.ok) {
                    const text = await response.text()
                    console.warn('[Sentry] Failed to send event:', response.status, text)
                    return null
                }

                const result = await response.json()
                return result
            } catch (error) {
                console.error('[Sentry] Error sending event:', error)
                return null
            }
        }

        /**
         * Инициализирует автоматический перехват ошибок
         */
        installGlobalHandlers() {
            // Перехват необработанных ошибок
            if (typeof window !== 'undefined') {
                window.addEventListener('error', (event) => {
                    this.captureException(event.error || new Error(event.message))
                })

                window.addEventListener('unhandledrejection', (event) => {
                    this.captureException(event.reason || new Error('Unhandled Promise rejection'))
                })
            } else if (typeof self !== 'undefined') {
                // Service Worker context
                self.addEventListener('error', (event) => {
                    this.captureException(event.error || new Error(event.message))
                })

                self.addEventListener('unhandledrejection', (event) => {
                    this.captureException(event.reason || new Error('Unhandled Promise rejection'))
                })
            }
        }
    }

    // Глобальный экземпляр Sentry
    let sentryInstance = null

    // Public API (совместимый с Sentry SDK)
    const Sentry = {
        init(options) {
            sentryInstance = new SentryClient(options)
            sentryInstance.installGlobalHandlers()
            return sentryInstance
        },

        captureException(error, hint) {
            if (!sentryInstance) {
                console.warn('[Sentry] Not initialized')
                return null
            }
            return sentryInstance.captureException(error, hint)
        },

        captureMessage(message, level) {
            if (!sentryInstance) {
                console.warn('[Sentry] Not initialized')
                return null
            }
            return sentryInstance.captureMessage(message, level)
        },

        setContext(key, value) {
            if (!sentryInstance) return
            sentryInstance.setContext(key, value)
        },

        setUser(user) {
            if (!sentryInstance) return
            sentryInstance.setUser(user)
        }
    }

    // Экспортируем Sentry в глобальную область
    global.Sentry = Sentry

})(typeof window !== 'undefined' ? window : self);
