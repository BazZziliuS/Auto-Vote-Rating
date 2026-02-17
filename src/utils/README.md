# Utils - Модульная структура утилит

Директория содержит переиспользуемые модули для расширения Auto Vote Rating.

> **Важно:** После рефакторинга (2026-02-16) все пути импорта используют **абсолютные пути с префиксом `/`** для корректной работы в Service Worker контексте.

## 📁 Структура модулей

```
src/utils/
├── index.js                       # 🎯 Barrel export (импорт всех модулей)
├── README.md                      # 📖 Документация
│
├── core/                          # Базовые утилиты
│   ├── constants.js               # ⚙️ Константы TIME и LIMITS
│   ├── time.js                    # ⏰ Утилиты времени
│   ├── project.js                 # 📊 Утилиты проектов
│   └── retry.js                   # 🔄 Retry логика
│
├── database/                      # Работа с IndexedDB
│   ├── database-helpers.js        # 💾 CRUD операции с IndexedDB
│   ├── db-init.js                 # 🚀 Инициализация и загрузка данных
│   └── db-migrations/             # Миграции базы данных
│       ├── index.js               # Экспорт функции runDatabaseUpgrade
│       ├── migration-v0.js        # v0: Начальная схема БД
│       ├── migration-v1-v12.js    # v1-v12: Ранние миграции
│       ├── migration-v13.js       # v13: Добавление полей
│       └── migration-v14.js       # v14: Обновление схемы
│
├── voting/                        # Логика голосования
│   ├── opened-projects-manager.js # 🗂️ Менеджер открытых проектов
│   ├── vote-time-calculator.js    # 🕐 Вычисление времени голосования
│   ├── vote-result-handler.js     # ✅ Обработка результатов
│   ├── stats-updater.js           # 📈 Обновление статистики
│   ├── silent-vote-handler.js     # 🤫 Silent vote обработка
│   ├── message-handlers.js        # 📨 Обработка сообщений
│   ├── error-handler.js           # ⚠️ Обработка ошибок
│   └── end-vote-helpers.js        # 🏁 Helper функции для endVote
│
└── browser/                       # Утилиты браузера
    ├── alarms.js                  # ⏰ Chrome alarms API
    ├── tab-manager.js             # 🗂️ Управление вкладками
    ├── notifications.js           # 🔔 Уведомления
    ├── cookies-manager.js         # 🍪 Управление cookies
    ├── url-matchers.js            # 🔗 Проверка и сопоставление URL
    ├── connection-checker.js      # 🌐 Проверка соединения
    ├── browser-detector.js        # 🔍 Определение браузера
    ├── console-interceptor.js     # 📝 Логирование в IndexedDB
    ├── script-injector.js         # 💉 Инъекция скриптов
    ├── listener-manager.js        # 🎧 Управление listeners
    └── notification-handlers.js   # 🔔 Обработчики уведомлений
```

## 🔧 Разделение контекстов

**Service Worker (background.js):**
- Использует `importScripts()` с абсолютными путями от корня расширения
- Пример: `importScripts('/src/utils/index.js')`
- Все пути начинаются с `/`

**HTML Context (options.html):**
- Использует теги `<script>` с относительными путями
- Пример: `<script src="../utils/database/db-init.js"></script>`
- Пути относительно местоположения HTML файла

**Общая логика (main.js):**
- Загружается и в Service Worker, и в HTML
- Не содержит `importScripts()` - импорты делаются в вызывающем контексте

## 📁 Структура модулей

### ⏰ Время и задержки

#### `time.js`
Утилиты для работы со временем.

**Функции:**
- `wait(ms)` - Промис-обертка над setTimeout

**Используется в:** background.js, tab-manager.js

---

#### `alarms.js`
Вспомогательные функции для работы с chrome.alarms.

**Функции:**
- `createSafeAlarm(name, when, project)` - Создает alarm с учетом минимальной задержки
- `hasAlarmWithTime(scheduledTime)` - Проверяет существование alarm с данной временной меткой

**Используется в:** background.js

---

### 📊 Проекты и статистика

#### `project.js`
Утилиты для работы с объектами проектов.

**Функции:**
- `getProjectPrefix(project, detailed)` - Форматирует префикс проекта для логов

**Используется в:** background.js, tab-manager.js, notifications.js

---

#### `stats-updater.js`
Обновление статистики голосований.

**Функции:**
- `updateSuccessStats(project, generalStats, todayStats)` - Обновляет статистику при успешном голосовании
- `updateLaterStats(project, generalStats, todayStats)` - Обновляет статистику при отложенном голосовании
- `updateErrorStats(project, generalStats, todayStats)` - Обновляет статистику при ошибке
- `checkAndUpdateMonthlyStats(project)` - Проверяет и обновляет месячную статистику
- `checkAndUpdateGeneralMonthlyStats(generalStats)` - Проверяет общую месячную статистику
- `checkAndUpdateDailyStats(todayStats)` - Проверяет и обновляет дневную статистику
- `initializeStatsBeforeVote(project, generalStats, todayStats)` - Инициализирует статистику перед голосованием

**Используется в:** background.js (newWindow, endVote)

---

#### `vote-time-calculator.js`
Вычисление времени следующего голосования.

**Функции:**
- `calculateNextVoteTime(project, request, allProjects)` - Основная функция вычисления времени
- `calculateCustomTimeout(project, time)` - Для custom проектов
- `calculateLaterTimeout(project, request, time, allProjects)` - Для проектов с later
- `calculateStandardTimeout(project, request, time, allProjects)` - Для стандартных проектов
- `calculateWeeklyTimeout(project, time, timeoutRating)` - Для еженедельного сброса
- `calculateMonthlyTimeout(project, time, timeoutRating)` - Для ежемесячного сброса
- `calculateDailyTimeout(project, time, timeoutRating)` - Для ежедневного сброса
- `calculateHourlyTimeout(project, request, time, timeoutRating, allProjects)` - Для почасового сброса

**Используется в:** background.js (endVote)

---

#### `vote-result-handler.js`
Обработка результатов голосования.

**Функции:**
- `getVoteResultType(request)` - Определяет тип результата ('success'|'later'|'error')
- `calculateErrorCooldown(request, project, settings)` - Вычисляет cooldown для retry при ошибке
- `applyRandomization(baseCooldown, project)` - Применяет рандомизацию к cooldown
- `applyVoteTimeRandomization(baseTime, project)` - Применяет рандомизацию к времени голосования
- `formatErrorMessage(request, chrome)` - Форматирует сообщение об ошибке
- `formatSuccessMessage(request, chrome)` - Форматирует сообщение об успехе
- `formatLaterMessage(request, chrome)` - Форматирует сообщение о уже поданном голосе
- `shouldNotifyError(request)` - Определяет нужно ли отправлять уведомление об ошибке

**Используется в:** background.js (endVote)

---

### 🤫 Silent Vote

#### `silent-vote-handler.js`
Обработка silent vote (голосование без открытия вкладки).

**Функции:**
- `executeSilentVote(project, silentResponseBody)` - Выполняет silent vote
- `handleSilentVoteError(error, project, silentResponseBody)` - Обрабатывает ошибку
- `validateSilentVoteResponse(project, response, url, bypassCodes, vk, silentResponseBody)` - Проверяет ответ
- `extractVKAuthError(response)` - Извлекает ошибку авторизации VK

**Используется в:** background.js

---

### 🗂️ Вкладки браузера

#### `tab-manager.js`
Управление вкладками браузера.

**Функции:**
- `tryOpenTab(options, project, attempt)` - Открывает вкладку с retry
- `tryCloseTab(tabId, project, attempt)` - Закрывает вкладку с retry
- `tryGroupTabs(options, attempt)` - Группирует вкладки с retry
- `checkWindow(project)` - Проверяет наличие окон
- `groupTabIntoAutoVoteGroup(tab, groupId)` - Группирует вкладку в группу "Auto Vote Rating"

**Используется в:** background.js

---

### 💾 База данных

#### `database-helpers.js`
Вспомогательные функции для работы с IndexedDB.

**Функции:**
- `updateStoreValue(db, storeName, value)` - Обновляет значение и отправляет уведомление
- `saveMultipleToOther(db, values)` - Сохраняет несколько значений в 'other'
- `loadMultipleFromOther(db, keys)` - Загружает несколько значений из 'other'
- `getProjectsByRating(db, rating)` - Получает все проекты для рейтинга
- `updateProject(db, project, cursor)` - Обновляет проект
- `clearStore(db, storeName)` - Очищает хранилище
- `recordExists(db, storeName, key)` - Проверяет существование записи

**Используется в:** background.js, main.js

---

#### `opened-projects-manager.js`
Менеджер для работы с Map открытых проектов.

**Функции:**
- `createOpenedProject(project, settings)` - Создает объект opened проекта
- `cleanupProjectTempFields(project)` - Очищает временные поля
- `isTimeoutExpired(openedValue)` - Проверяет истечение timeout
- `hasConflict(project, openedValue, settings)` - Проверяет конфликт проектов
- `canRestart(tabKey, openedValue, settings)` - Проверяет возможность перезапуска
- `findOpenedProject(openedProjects, projectKey)` - Находит открытый проект
- `createQueuedProject(opened, timeout, project)` - Создает объект для очереди
- `cleanupExpiredQueue(openedProjects)` - Удаляет истекшие записи

**Используется в:** background.js

---

### 📨 Обработка сообщений

#### `message-handlers.js`
Обработчики сообщений chrome.runtime.onMessage.

**Функции:**
- `handleReloadCaptcha(sender, settings)` - Перезагрузка капчи
- `handleCaptchaPassed(request, sender)` - Обработка пройденной капчи
- `handleHackTimer(request, sender, fakeIdToId)` - Обработка HackTimer сообщений
- `triggerTimer(name, sender, fakeId, fakeIdToId)` - Триггер таймера в content script
- `handleProjectDeleted(request, openedProjects, db)` - Обработка удаления проекта
- `handleProjectRestart(request, openedProjects, db, settings)` - Обработка перезапуска проекта

**Используется в:** background.js

---

### 🍪 Cookies

#### `cookies-manager.js`
Управление cookies браузера.

**Функции:**
- `clearDomainCookies(domain, debug)` - Очищает все cookies для указанного домена
- `clearMonitoringMinecraftCookies(project, debug)` - Очищает cookies для monitoringminecraft.ru

**Используется в:** background.js (checkOpen)

---

### 🏁 Завершение голосования

#### `end-vote-helpers.js`
Helper функции для функции endVote.

**Функции:**
- `checkIncorrectDomain(request, sender, project)` - Проверяет и добавляет информацию о неправильном домене
- `closeTabIfNeeded(request, sender, project, settings)` - Закрывает вкладку в зависимости от результата
- `findAndPrepareOpenedProject(openedProjects, project, timeout, db)` - Находит и подготавливает opened проект
- `applyTimeRandomization(project, time)` - Применяет рандомизацию к времени голосования

**Используется в:** background.js (endVote)

---

### 🔗 Проверка URL

#### `url-matchers.js`
Утилиты для проверки и сопоставления URL.

**Функции:**
- `isAuthUrl(url)` - Проверяет является ли URL авторизационным
- `isCaptchaUrl(url)` - Проверяет является ли URL капчей (полная проверка)
- `isCaptchaUrlForCommitted(url)` - Проверка капчи для committed listener
- `isCaptchaDomain(url)` - Проверяет является ли URL доменом капчи
- `isIgnorableNetworkError(errorMessage)` - Проверяет игнорируемые сетевые ошибки

**Используется в:** background.js (webNavigationOnCommittedListener, webNavigationOnCompletedListener, webRequestOnErrorOccurredListener, webNavigationOnErrorOccurredListener)

---

### ⚠️ Обработка ошибок

#### `error-handler.js`
Обработка ошибок при работе со вкладками и инъекцией скриптов.

**Функции:**
- `catchTabError(error, project, db)` - Обрабатывает ошибки вкладок и скриптов

**Игнорируемые ошибки:**
- "The frame was removed."
- "The tab was closed."
- "PrecompiledScript.executeInGlobal" (FireFox)
- "Could not establish connection. Receiving end does not exist"
- И другие несущественные ошибки

**Используется в:** background.js (webNavigationOnCommittedListener, webNavigationOnCompletedListener)

---

### 🔔 Уведомления и логирование

#### `notifications.js`
Отправка уведомлений пользователю.

**Функции:**
- `sendNotification(title, message, type, notificationId)` - Отправляет уведомление

**Параметры type:**
- `'start'` - Начало голосования
- `'info'` - Успешное голосование
- `'warn'` - Предупреждение
- `'error'` - Ошибка

**Используется в:** background.js, tab-manager.js

---

#### `console-interceptor.js`
Перехват console для логирования в IndexedDB.

**Переопределяет:**
- `console.log`, `console.info`, `console.warn`, `console.error`, `console.debug`

**Функции:**
- `console._intercept(type, args)` - Точка перехвата
- `console._collect(type, args)` - Сборщик логов

**Используется в:** background.js, автоматически при импорте

---

### 🔄 Retry логика

#### `retry.js`
Вспомогательные функции для повторных попыток.

**Функции:**
- `retryOnTabsLock(operation, maxAttempts, retryDelay)` - Выполняет операцию с retry при ошибке "Tabs cannot be edited"

**Используется в:** tab-manager.js

---

### 🎯 Константы

#### `constants.js`
Именованные константы вместо магических чисел.

**Объекты:**

```javascript
TIME = {
    MIN_ALARM_DELAY: 65000,              // Минимальная задержка для chrome.alarms
    TAB_OPERATION_RETRY_DELAY: 500,      // Задержка retry для операций с вкладками
    MIN_RANDOMIZATION_DEFAULT: 300000,   // Минимальная рандомизация (5 мин)
    MAX_RANDOMIZATION_DEFAULT: 600000,   // Максимальная рандомизация (10 мин)
    TAB_LOAD_CHECK_DELAY: 250,           // Задержка проверки загрузки вкладки
    MIN_PROJECT_RANDOMIZATION: 10000,    // Минимальная рандомизация проекта
    MAX_PROJECT_RANDOMIZATION: 60000,    // Максимальная рандомизация проекта
    MIN_RANDOMIZE_COOLDOWN: 1800000,     // Минимальный cooldown для randomize (30 мин)
    MAX_RANDOMIZE_COOLDOWN: 2400000,     // Максимальный cooldown для randomize (40 мин)
    MAX_ERROR_RANDOMIZATION: 900000,     // Максимальная рандомизация ошибки (15 мин)
    ERROR_404_COOLDOWN: 21600000         // Cooldown для 404 ошибки (6 часов)
}

LIMITS = {
    MAX_INJECT_ATTEMPTS: 10,             // Максимум попыток inject скрипта
    MAX_TAB_OPERATION_RETRIES: 3,        // Максимум retry для операций с вкладками
    MAX_TAB_LOAD_WAIT_CYCLES: 9,         // Максимум циклов ожидания загрузки вкладки
    ERROR_RETRY_MINUTES: 15              // Задержка для retry при ошибке (минуты)
}
```

**Используется в:** background.js, tab-manager.js, retry.js, alarms.js

---

## 🔧 Импорт модулей

### Способ 1: Barrel export (рекомендуется для Service Worker)

```javascript
// В background.js
importScripts('/src/utils/index.js')  // Импортирует все модули в правильном порядке
```

### Способ 2: Индивидуальный импорт

В `src/core/background.js` модули импортируются в следующем порядке:

```javascript
// Библиотеки и основные модули
importScripts('/libs/idb.umd.js')
importScripts('/libs/linkedom.js')
importScripts('/src/core/projects.js')

// Database migrations (порядок важен!)
importScripts('/src/utils/database/db-migrations/migration-v0.js')
importScripts('/src/utils/database/db-migrations/migration-v1-v12.js')
importScripts('/src/utils/database/db-migrations/migration-v13.js')
importScripts('/src/utils/database/db-migrations/migration-v14.js')
importScripts('/src/utils/database/db-migrations/index.js')

// Database initialization
importScripts('/src/utils/database/db-init.js')

// Main initialization
importScripts('/src/core/main.js')

// Utilities (через barrel export или отдельно)
importScripts('/src/utils/index.js')

// Или индивидуально:
// importScripts('/src/utils/core/constants.js')              // Сначала константы
// importScripts('/src/utils/core/time.js')                   // Базовые утилиты
// importScripts('/src/utils/core/project.js')
// importScripts('/src/utils/core/retry.js')
// importScripts('/src/utils/database/database-helpers.js')   // Работа с БД
// importScripts('/src/utils/voting/opened-projects-manager.js')
// importScripts('/src/utils/voting/vote-time-calculator.js')
// importScripts('/src/utils/voting/vote-result-handler.js')
// importScripts('/src/utils/voting/stats-updater.js')
// importScripts('/src/utils/voting/silent-vote-handler.js')
// importScripts('/src/utils/voting/message-handlers.js')
// importScripts('/src/utils/voting/error-handler.js')
// importScripts('/src/utils/voting/end-vote-helpers.js')
// importScripts('/src/utils/browser/alarms.js')
// importScripts('/src/utils/browser/tab-manager.js')
// importScripts('/src/utils/browser/notifications.js')
// importScripts('/src/utils/browser/cookies-manager.js')
// importScripts('/src/utils/browser/url-matchers.js')
// importScripts('/src/utils/browser/connection-checker.js')
// importScripts('/src/utils/browser/browser-detector.js')
// importScripts('/src/utils/browser/console-interceptor.js')  // Последним - перехват console
// importScripts('/src/utils/browser/script-injector.js')
// importScripts('/src/utils/browser/listener-manager.js')
// importScripts('/src/utils/browser/notification-handlers.js')
```

### Способ 3: HTML Context (options.html)

```html
<!-- Database migrations -->
<script src="../utils/database/db-migrations/migration-v0.js"></script>
<script src="../utils/database/db-migrations/migration-v1-v12.js"></script>
<script src="../utils/database/db-migrations/migration-v13.js"></script>
<script src="../utils/database/db-migrations/migration-v14.js"></script>
<script src="../utils/database/db-migrations/index.js"></script>

<!-- Database initialization -->
<script src="../utils/database/db-init.js"></script>

<!-- Main logic -->
<script src="../core/main.js"></script>

<!-- Utilities (загружаются выборочно, не все нужны в HTML) -->
<script src="../utils/core/constants.js"></script>
<script src="../utils/database/database-helpers.js"></script>
<!-- ... остальные по необходимости -->
```

## 💾 Database Migrations

Модульная система миграций базы данных позволяет безопасно обновлять схему IndexedDB.

### Структура миграций

```
src/utils/database/db-migrations/
├── index.js               # Экспорт runDatabaseUpgrade()
├── migration-v0.js        # createInitialSchema() - начальная схема
├── migration-v1-v12.js    # Ранние миграции (v1-v12)
├── migration-v13.js       # Миграция v13
└── migration-v14.js       # Миграция v14
```

### Как работает система миграций

1. **Регистрация миграций** (`index.js`):
```javascript
const migrations = {
    0: createInitialSchema,
    1: migrateToV1,
    // ... до v14
    14: migrateToV14
}

function runDatabaseUpgrade(db, oldVersion, newVersion, transaction, allProjects, getDomainWithoutSubdomain) {
    for (let version = oldVersion; version < newVersion; version++) {
        const migrate = migrations[version]
        if (migrate) {
            migrate(db, transaction, allProjects, getDomainWithoutSubdomain)
        }
    }
}
```

2. **Использование в main.js**:
```javascript
db = await idb.openDB('avr', 15, {
    upgrade: (db, oldVersion, newVersion, transaction) => {
        return runDatabaseUpgrade(db, oldVersion, newVersion, transaction, allProjects, getDomainWithoutSubdomain)
    }
})
```

3. **Создание новой миграции**:
- Создать файл `migration-vXX.js`
- Экспортировать функцию `migrateToVXX(db, transaction)`
- Импортировать в `index.js`
- Зарегистрировать в объекте `migrations`
- Увеличить версию БД в `main.js`

### Пример миграции

```javascript
// migration-v15.js
function migrateToV15(db, transaction) {
    const projectsStore = transaction.objectStore('projects')

    // Добавить индекс
    if (!projectsStore.indexNames.contains('byDomain')) {
        projectsStore.createIndex('byDomain', 'domain', { unique: false })
    }

    console.log('Migration to v15 completed')
}
```

---

## 🎯 Common Patterns

### Отправка конкретного времени кулдауна

**ВАЖНО:** Всегда отправляйте конкретный timestamp, а не `{later: true}`!

```javascript
// ❌ НЕПРАВИЛЬНО - может создать voting loop
if (cooldownDetected) {
    chrome.runtime.sendMessage({later: true})
}

// ✅ ПРАВИЛЬНО - отправляем конкретное время
function sendCooldown(hours) {
    const milliseconds = (hours * 60 * 60 * 1000) + (60 * 1000)  // +1 минута запас
    const nextVoteTime = Date.now() + milliseconds

    console.log('[Cooldown] Calculated:', hours, 'hours ->', new Date(nextVoteTime).toLocaleString())
    chrome.runtime.sendMessage({later: nextVoteTime})
}

if (cooldownDetected) {
    sendCooldown(10)  // 10 часов кулдаун
}
```

**Почему это важно:**
- Если отправить `{later: true}`, background пытается вычислить время на основе `project.stats.lastSuccessVote`
- Если `lastSuccessVote` пустой или некорректный, кулдаун может истечь мгновенно → voting loop
- Конкретный timestamp гарантирует правильное время следующего голосования

### Парсинг времени кулдауна

Всегда парсите время ДО клика по кнопке, не после:

```javascript
// Парсинг русского формата "3 ч. 37 м. 36 с."
function parseCooldownTime(text) {
    const cleanText = text.trim().replace(/\s+/g, ' ')

    // Формат: "3 ч. 37 м. 36 с."
    const russianMatch = cleanText.match(/(\d+)\s*ч\.?\s*(\d+)\s*м\.?\s*(\d+)\s*с\.?/)
    if (russianMatch) {
        const hours = parseInt(russianMatch[1]) || 0
        const minutes = parseInt(russianMatch[2]) || 0
        const seconds = parseInt(russianMatch[3]) || 0

        const milliseconds = (hours * 60 * 60 * 1000) + (minutes * 60 * 1000) + (seconds * 1000)
        const result = Date.now() + milliseconds + (30 * 1000)  // +30 сек запас

        console.log('[Parsed]:', cleanText, '→', hours + 'h', minutes + 'm', seconds + 's')
        return result
    }

    // Формат: "21:59:02" (HH:MM:SS)
    const timeMatch = cleanText.match(/(\d+):(\d+):(\d+)/)
    if (timeMatch) {
        const hours = parseInt(timeMatch[1])
        const minutes = parseInt(timeMatch[2])
        const seconds = parseInt(timeMatch[3])

        const milliseconds = (hours * 60 * 60 * 1000) + (minutes * 60 * 1000) + (seconds * 1000)
        return Date.now() + milliseconds + (30 * 1000)
    }

    return null
}

// Использование:
const timerElement = document.querySelector('.cooldown-timer')
if (timerElement && timerElement.offsetParent !== null) {
    const cooldownTime = parseCooldownTime(timerElement.textContent)
    if (cooldownTime) {
        chrome.runtime.sendMessage({later: cooldownTime})
        return
    }
}
```

### Детальное логирование для отладки

Используйте подробные логи для отслеживания процесса голосования:

```javascript
async function vote(first) {
    console.log('[Vote] Starting, first:', first)

    // Шаг 1: Проверка кулдауна
    console.log('[Vote] Step 1: Checking cooldown...')
    const cooldownElement = document.querySelector('.timer')
    if (cooldownElement) {
        console.log('[Vote] ✓ COOLDOWN detected:', cooldownElement.textContent)
        const time = parseCooldownTime(cooldownElement.textContent)
        chrome.runtime.sendMessage({later: time})
        return
    }
    console.log('[Vote] ✓ No cooldown, proceeding')

    // Шаг 2: Клик по кнопке
    console.log('[Vote] Step 2: Finding vote button...')
    const button = document.querySelector('.vote-btn')
    if (!button) {
        console.log('[Vote] ✗ Vote button not found')
        chrome.runtime.sendMessage({errorVoteNoElement: 'Vote button not found'})
        return
    }
    console.log('[Vote] ✓ Button found, clicking...')
    button.click()

    // Шаг 3: Проверка результата
    console.log('[Vote] Step 3: Waiting for result...')
    await new Promise(resolve => setTimeout(resolve, 2000))

    if (document.querySelector('.success')) {
        console.log('[Vote] ✓ SUCCESS confirmed')
        chrome.runtime.sendMessage({successfully: Date.now()})
        return
    }

    console.log('[Vote] ✗ Success not confirmed')
}
```

---

## 📝 Правила разработки

1. **Один модуль = одна ответственность**
2. **Функции должны быть чистыми** (без side-effects где возможно)
3. **Все функции документированы JSDoc**
4. **Константы вместо магических чисел**
5. **Guard clauses вместо глубокой вложенности**

## 🚀 Добавление нового модуля

1. **Определить категорию модуля**:
   - `core/` - базовые утилиты (время, константы, retry)
   - `database/` - работа с IndexedDB
   - `voting/` - логика голосования
   - `browser/` - обертки над Browser API

2. **Создать файл** в соответствующей директории `src/utils/{category}/module-name.js`

3. **Добавить JSDoc** к функциям:
```javascript
/**
 * Описание функции
 * @param {Type} param - Описание параметра
 * @returns {Type} Описание возвращаемого значения
 */
function myFunction(param) {
    // ...
}
```

4. **Импортировать в `src/utils/index.js`** в правильном порядке (с абсолютным путём):
```javascript
importScripts('/src/utils/{category}/module-name.js')
```

5. **Обновить этот README**:
   - Добавить описание модуля в секцию "Структура модулей"
   - Указать экспортируемые функции
   - Добавить примеры использования

6. **Протестировать изменения**:
   - Перезагрузить расширение в `chrome://extensions/`
   - Проверить Service Worker в `chrome://serviceworker-internals/`
   - Убедиться что нет ошибок импорта

---

**История рефакторинга:**
- 2026-02-16: Начальная модульная структура после рефакторинга
- 2026-02-17: Обновлена документация, добавлены секции Database Migrations и Common Patterns

**Версия:** 1.1
