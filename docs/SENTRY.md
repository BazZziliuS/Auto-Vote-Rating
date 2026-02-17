# Sentry Error Monitoring

Расширение использует [Sentry](https://sentry.io/) для автоматического отслеживания и мониторинга ошибок.

## 📊 Что отслеживается

### UI Context (options.html)
- JavaScript ошибки на странице настроек
- Promise rejections
- Performance monitoring (10% транзакций)
- Session replay (10% обычных сессий, 100% сессий с ошибками)
- User interactions tracking

### Service Worker (background.js)
- Необработанные ошибки в Service Worker
- Promise rejections
- Ошибки при работе с вкладками
- Ошибки при голосовании
- Ошибки базы данных

## 🔧 Конфигурация

### Файлы конфигурации:

**`src/core/sentry-init.js`** - инициализация для UI (options.html)
- Настройка интеграций (Browser Tracing, Replay)
- Фильтрация безвредных ошибок
- Установка контекста расширения

**`src/core/sentry-background.js`** - инициализация для Service Worker
- Загрузка Sentry SDK через importScripts
- Перехват необработанных ошибок
- Фильтрация специфичных для extensions ошибок

### Параметры:

```javascript
{
  dsn: 'https://af65e911a63f25c10b114b5d73f3d372@o4510900208730112.ingest.de.sentry.io/4510900210761808',
  release: 'auto-vote-rating@7.3.0',
  environment: 'production',
  sampleRate: 1.0               // 100% ошибок
}
```

## 🚫 Фильтрация ошибок

### Игнорируемые паттерны:

Следующие типы ошибок **не отправляются** в Sentry, так как они являются нормальным поведением расширений:

```javascript
// Extension context errors
'extension context invalidated'
'the frame was removed'
'the tab was closed'
'receiving end does not exist'
'could not establish connection'
'message port closed'

// Network errors
'load failed'
'net::err_'

// Tab management
'tabs cannot be edited'
'no tab with id'

// Known browser issues
'ResizeObserver loop limit exceeded'
'Non-Error promise rejection captured'
```

## 📦 Зависимости

### Manifest.json изменения:

**Host permissions:**
```json
"host_permissions": [
  "https://*.sentry-cdn.com/*",
  "https://*.sentry.io/*"
]
```

**Content Security Policy:**
```json
"content_security_policy": {
  "extension_pages": "script-src 'self' https://js-de.sentry-cdn.com https://browser.sentry-cdn.com; object-src 'self'"
}
```

### Загружаемые скрипты:

**UI (options.html):**
```html
<script src="https://js-de.sentry-cdn.com/af65e911a63f25c10b114b5d73f3d372.min.js" crossorigin="anonymous"></script>
<script src="../core/sentry-init.js"></script>
```

**Service Worker (background.js):**
```javascript
importScripts('https://browser.sentry-cdn.com/8.46.0/bundle.min.js')
```

## 🔍 Отладка Sentry

### Проверка инициализации:

**В консоли options.html:**
```javascript
// Должно вывести: [Sentry] Error monitoring initialized for version 7.3.0
```

**В консоли Service Worker:**
```javascript
// Должно вывести: [Sentry Background] Error monitoring initialized for version 7.3.0
```

### Тестирование отправки ошибок:

**В options.html:**
```javascript
// Откройте DevTools на странице настроек
Sentry.captureException(new Error('Test error from options page'))
```

**В Service Worker:**
```javascript
// Откройте DevTools для Service Worker (chrome://serviceworker-internals/)
Sentry.captureException(new Error('Test error from service worker'))
```

Ошибки должны появиться в панели Sentry через несколько секунд.

## 📈 Просмотр данных

1. Войдите в [Sentry Dashboard](https://o4508675969376256.ingest.de.sentry.io/)
2. Выберите проект **Auto Vote Rating**
3. Вкладки:
   - **Issues** - список ошибок
   - **Performance** - мониторинг производительности
   - **Replays** - записи сессий с ошибками

## 🔐 Приватность

### Что собирается:
- Stack traces ошибок
- Версия расширения и браузера
- URL страницы, где произошла ошибка
- Timestamp ошибки
- User interactions (для replay)

### Что НЕ собирается:
- Личные данные пользователей
- Пароли или токены
- Содержимое форм (по умолчанию замаскировано)
- История посещений

### Настройки приватности:

```javascript
Sentry.replayIntegration({
  maskAllText: false,      // Не маскировать текст (расширение не обрабатывает приватные данные)
  blockAllMedia: false,    // Не блокировать медиа
})
```

## 🛠️ Отключение Sentry

### Для разработки:

**Вариант 1: Удалить скрипты**
```html
<!-- Закомментировать в options.html -->
<!--
<script src="https://js-de.sentry-cdn.com/..."></script>
<script src="../core/sentry-init.js"></script>
-->
```

```javascript
// Закомментировать в background.js
// importScripts('/src/core/sentry-background.js')
```

**Вариант 2: Условная инициализация**
```javascript
// В sentry-init.js и sentry-background.js
const ENABLE_SENTRY = false // Установить в false для отключения
if (ENABLE_SENTRY && typeof Sentry !== 'undefined') {
  // ...инициализация
}
```

## 📚 Ресурсы

- [Sentry JavaScript SDK](https://docs.sentry.io/platforms/javascript/)
- [Sentry Browser Extensions Guide](https://docs.sentry.io/platforms/javascript/guides/browser-extension/)
- [Session Replay](https://docs.sentry.io/platforms/javascript/session-replay/)
- [Performance Monitoring](https://docs.sentry.io/platforms/javascript/performance/)

---

**Дата добавления:** 2026-02-17
**Версия Sentry SDK:** 8.46.0
**DSN:** af65e911a63f25c10b114b5d73f3d372
