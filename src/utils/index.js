/**
 * Barrel export для всех утилит
 *
 * Использование:
 * importScripts('/src/utils/index.js')
 */

// === CORE UTILITIES (базовые утилиты) ===
// Порядок важен! Константы должны быть первыми
importScripts('/src/utils/core/constants.js')
importScripts('/src/utils/core/time.js')
importScripts('/src/utils/core/project.js')
importScripts('/src/utils/core/retry.js')

// === DATABASE UTILITIES (утилиты БД) ===
importScripts('/src/utils/database/database-helpers.js')

// === VOTING UTILITIES (утилиты голосования) ===
importScripts('/src/utils/voting/opened-projects-manager.js')
importScripts('/src/utils/voting/vote-time-calculator.js')
importScripts('/src/utils/voting/vote-result-handler.js')
importScripts('/src/utils/voting/stats-updater.js')
importScripts('/src/utils/voting/silent-vote-handler.js')
importScripts('/src/utils/voting/message-handlers.js')
importScripts('/src/utils/voting/error-handler.js')
importScripts('/src/utils/voting/end-vote-helpers.js')

// === BROWSER UTILITIES (утилиты браузера) ===
importScripts('/src/utils/browser/alarms.js')
importScripts('/src/utils/browser/tab-manager.js')
importScripts('/src/utils/browser/notifications.js')
importScripts('/src/utils/browser/cookies-manager.js')
importScripts('/src/utils/browser/url-matchers.js')
importScripts('/src/utils/browser/connection-checker.js')
importScripts('/src/utils/browser/browser-detector.js')
importScripts('/src/utils/browser/console-interceptor.js')
importScripts('/src/utils/browser/script-injector.js')
importScripts('/src/utils/browser/listener-manager.js')
importScripts('/src/utils/browser/notification-handlers.js')
