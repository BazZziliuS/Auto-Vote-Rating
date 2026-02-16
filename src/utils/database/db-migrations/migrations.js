/**
 * Barrel export для всех миграций базы данных
 *
 * Использование в main.js:
 * importScripts('src/utils/database/db-migrations/migrations.js')
 */

// Импорт всех миграций
importScripts('src/utils/database/db-migrations/migration-v0.js')
importScripts('src/utils/database/db-migrations/migration-v1-v12.js')
importScripts('src/utils/database/db-migrations/migration-v13.js')
importScripts('src/utils/database/db-migrations/migration-v14.js')
importScripts('src/utils/database/db-migrations/index.js')
