/**
 * Barrel export для всех миграций базы данных
 *
 * Использование в main.js:
 * importScripts('utils/db-migrations/migrations.js')
 */

// Импорт всех миграций
importScripts('utils/db-migrations/migration-v0.js')
importScripts('utils/db-migrations/migration-v1-v12.js')
importScripts('utils/db-migrations/migration-v13.js')
importScripts('utils/db-migrations/migration-v14.js')
importScripts('utils/db-migrations/index.js')
