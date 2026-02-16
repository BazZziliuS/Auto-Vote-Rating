# Utils - Модульная структура утилит

Директория содержит переиспользуемые модули для расширения Auto Vote Rating.

## 📁 Структура модулей (19 модулей)

```
utils/
├── index.js                      # 🎯 Barrel export (импорт всех модулей)
├── README.md                     # 📖 Документация
├── constants.js                  # ⚙️ Константы TIME и LIMITS
├── time.js                       # ⏰ Утилиты времени
├── project.js                    # 📊 Утилиты проектов
├── retry.js                      # 🔄 Retry логика
├── database-helpers.js           # 💾 Работа с IndexedDB
├── opened-projects-manager.js    # 🗂️ Менеджер открытых проектов
├── alarms.js                     # ⏰ Chrome alarms
├── vote-time-calculator.js       # 🕐 Вычисление времени голосования
├── vote-result-handler.js        # ✅ Обработка результатов
├── stats-updater.js              # 📈 Обновление статистики
├── silent-vote-handler.js        # 🤫 Silent vote обработка
├── tab-manager.js                # 🗂️ Управление вкладками
├── message-handlers.js           # 📨 Обработка сообщений
├── notifications.js              # 🔔 Уведомления
├── cookies-manager.js            # 🍪 Управление cookies
├── error-handler.js              # ⚠️ Обработка ошибок
├── url-matchers.js               # 🔗 Проверка и сопоставление URL
├── end-vote-helpers.js           # 🏁 Helper функции для endVote
└── console-interceptor.js        # 📝 Логирование
```

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

### Способ 1: Barrel export (рекомендуется)

```javascript
importScripts('utils/index.js')  // Импортирует все модули в правильном порядке
```

### Способ 2: Индивидуальный импорт

В `background.js` модули импортируются в следующем порядке:

```javascript
importScripts('libs/idb.umd.js')
importScripts('projects.js')
importScripts('main.js')
importScripts('utils/constants.js')              // Сначала константы
importScripts('utils/time.js')                   // Базовые утилиты
importScripts('utils/project.js')
importScripts('utils/retry.js')
importScripts('utils/database-helpers.js')       // Работа с БД
importScripts('utils/opened-projects-manager.js') // Менеджер открытых проектов
importScripts('utils/alarms.js')
importScripts('utils/vote-time-calculator.js')
importScripts('utils/vote-result-handler.js')    // Обработка результатов
importScripts('utils/stats-updater.js')
importScripts('utils/tab-manager.js')
importScripts('utils/notifications.js')
importScripts('utils/cookies-manager.js')        // Управление cookies
importScripts('utils/error-handler.js')          // Обработка ошибок
importScripts('utils/url-matchers.js')           // Проверка URL
importScripts('utils/end-vote-helpers.js')       // Helper endVote
importScripts('utils/console-interceptor.js')    // Последним - перехват console
```

## 📝 Правила разработки

1. **Один модуль = одна ответственность**
2. **Функции должны быть чистыми** (без side-effects где возможно)
3. **Все функции документированы JSDoc**
4. **Константы вместо магических чисел**
5. **Guard clauses вместо глубокой вложенности**

## 🚀 Добавление нового модуля

1. Создать файл в `utils/`
2. Добавить JSDoc к функциям
3. Импортировать в `background.js` в правильном порядке
4. Обновить этот README
5. Протестировать изменения

---

**История рефакторинга:** 2026-02-16
**Версия:** 1.0
