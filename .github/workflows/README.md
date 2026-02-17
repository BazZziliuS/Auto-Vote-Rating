# GitHub Actions Workflows

Этот репозиторий использует GitHub Actions для автоматизации сборки и релизов расширения.

## 📋 Доступные Workflows

### 1. Build Extension (`build.yml`)

**Триггеры:**
- Push в ветки: `dev`, `main`, `refactor`
- Pull Request в ветки: `dev`, `main`
- Ручной запуск через GitHub UI

**Что делает:**
- Извлекает версию из `manifest.json`
- Создаёт zip-архив с расширением
- Создаёт .crx пакет (нативное расширение Chrome)
- Загружает оба артефакта для скачивания (хранятся 90 дней)

**Как использовать:**
1. Сделайте push в одну из веток
2. Перейдите в раздел "Actions" на GitHub
3. Откройте последний workflow run
4. Скачайте артефакты из раздела "Artifacts":
   - `Auto-Vote-Rating-ZIP-{version}-{branch}` - для "Load unpacked"
   - `Auto-Vote-Rating-CRX-{version}-{branch}` - нативный пакет

**Форматы артефактов:**
- ZIP: `Auto-Vote-Rating-7.2.6-dev.zip`
- CRX: `Auto-Vote-Rating-7.2.6-dev.crx`

---

### 2. Create Release (`release.yml`)

**Триггеры:**
- Push тега в формате `v*` (например, `v7.2.6`)
- Ручной запуск через GitHub UI с указанием тега

**Что делает:**
- Создаёт zip-архив с расширением
- Создаёт .crx пакет (нативное расширение Chrome)
- Генерирует changelog из коммитов
- Создаёт GitHub Release с прикреплёнными файлами (.zip и .crx)

**Как создать релиз:**

#### Вариант 1: Автоматически (через теги)
```bash
# Создайте тег с версией из manifest.json
git tag v7.2.6

# Отправьте тег на GitHub
git push origin v7.2.6
```

#### Вариант 2: Вручную через GitHub UI
1. Перейдите в "Actions" → "Create Release"
2. Нажмите "Run workflow"
3. Введите тег версии (например, `v7.2.6`)
4. Нажмите "Run workflow"

**Формат релиза:**
- **Название:** `Auto Vote Rating {version}`
- **Тег:** `v{version}`
- **Файл:** `Auto-Vote-Rating-{version}.zip`
- **Changelog:** Автоматически генерируется из коммитов

---

## 📦 Что включено в сборку

Архив содержит только необходимые для работы расширения файлы:

```
Auto-Vote-Rating/
├── src/              # Исходный код
├── libs/             # Библиотеки (idb, linkedom)
├── images/           # Иконки расширения
├── _locales/         # Локализация
├── css/              # Стили
├── fonts/            # Шрифты
├── manifest.json     # Манифест расширения
├── README.md         # Документация (только в релизах)
└── PRIVACY.md        # Политика конфиденциальности (только в релизах)
```

**Исключено:**
- `.git/` - история git
- `.github/` - GitHub Actions
- `.idea/` - настройки IDE
- `docs/` - документация для разработчиков
- `CLAUDE.md` - инструкции для Claude Code

---

## 🚀 Установка из артефакта

### Вариант 1: Из ZIP-архива (рекомендуется)

1. **Скачайте ZIP-архив:**
   - Из Artifacts (для build workflow)
   - Из Releases (для release workflow)

2. **Распакуйте архив:**
   ```bash
   unzip Auto-Vote-Rating-7.2.6.zip
   ```

3. **Установите в браузер:**
   - Откройте `chrome://extensions/`
   - Включите "Режим разработчика" (Developer mode)
   - Нажмите "Загрузить распакованное расширение" (Load unpacked)
   - Выберите папку `Auto-Vote-Rating`

### Вариант 2: Из CRX-пакета

#### ⚠️ Важно:
Chrome 73+ **блокирует** прямую установку `.crx` файлов не из Chrome Web Store.

#### Способы установки `.crx`:

**A) Через распаковку ZIP внутри CRX (самый простой):**
```bash
# .crx файл это просто ZIP-архив, можно распаковать
unzip Auto-Vote-Rating-7.2.6.crx -d Auto-Vote-Rating
# Затем установить как "Load unpacked"
```

**B) Через командную строку (для тестирования):**
```bash
# Windows
chrome.exe --load-extension="C:\path\to\Auto-Vote-Rating.crx"

# Linux/Mac
google-chrome --load-extension="/path/to/Auto-Vote-Rating.crx"
```

**C) Перетаскивание в chrome://extensions/ (иногда работает):**
1. Откройте `chrome://extensions/`
2. Включите "Режим разработчика"
3. Перетащите `.crx` файл на страницу
4. Если Chrome блокирует - используйте способ A

**D) Enterprise Policy (для организаций):**
- Настроить GPO для автоматической установки
- Подходит для корпоративного окружения

#### 🎯 Зачем нужен .crx если его сложно установить?

- ✅ Подготовка к публикации в Chrome Web Store
- ✅ Enterprise deployment через GPO
- ✅ Тестирование упаковки перед публикацией
- ✅ Распространение через сторонние магазины расширений
- ✅ Автоматическая установка через скрипты

---

## 🔧 Решение ошибки "CRX_REQUIRED_PROOF_MISSING"

### ❌ Проблема:
При попытке установить `.crx` файл в Chrome появляется ошибка:
```
Пакет недействителен: "CRX_REQUIRED_PROOF_MISSING"
Package is invalid: "CRX_REQUIRED_PROOF_MISSING"
```

### 📖 Причина:
Chrome требует, чтобы расширения были подписаны сертификатом Chrome Web Store или установлены через корпоративную политику. Это защита от вредоносных расширений.

### ✅ Решения (от простого к сложному):

#### **Решение 1: Распаковать как ZIP и установить** (рекомендуется)

**Шаг 1: Переименуйте файл**
```bash
# Windows (PowerShell)
Rename-Item Auto-Vote-Rating-7.2.6.crx Auto-Vote-Rating-7.2.6.zip

# Linux/Mac
mv Auto-Vote-Rating-7.2.6.crx Auto-Vote-Rating-7.2.6.zip
```

**Шаг 2: Распакуйте архив**
```bash
# Windows (PowerShell)
Expand-Archive Auto-Vote-Rating-7.2.6.zip -DestinationPath Auto-Vote-Rating

# Linux/Mac
unzip Auto-Vote-Rating-7.2.6.zip -d Auto-Vote-Rating
```

**Шаг 3: Установите в Chrome**
1. Откройте `chrome://extensions/`
2. Включите **"Режим разработчика"** (Developer mode) в правом верхнем углу
3. Нажмите **"Загрузить распакованное расширение"** (Load unpacked)
4. Выберите папку `Auto-Vote-Rating`
5. ✅ Готово! Расширение установлено

---

#### **Решение 2: Использовать ZIP-артефакт вместо CRX**

Просто скачайте `.zip` файл вместо `.crx`:
- В Artifacts ищите `Auto-Vote-Rating-ZIP-*` вместо `Auto-Vote-Rating-CRX-*`
- В Releases скачайте `.zip` файл

Затем следуйте шагам 2-3 из Решения 1.

---

#### **Решение 3: Установка через командную строку (временная)**

**Windows:**
```cmd
"C:\Program Files\Google\Chrome\Application\chrome.exe" ^
  --load-extension="C:\path\to\Auto-Vote-Rating.crx"
```

**Linux:**
```bash
google-chrome --load-extension="/path/to/Auto-Vote-Rating.crx"
```

**Mac:**
```bash
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --load-extension="/path/to/Auto-Vote-Rating.crx"
```

⚠️ **Недостаток:** Расширение останется активным только пока открыт Chrome, запущенный с этим флагом.

---

#### **Решение 4: Enterprise Policy (для корпоративных сред)**

Для системных администраторов, управляющих парком машин:

**Windows (через GPO):**
1. Разместите `.crx` файл на сетевом ресурсе
2. Создайте политику `ExtensionInstallForcelist` в `HKLM\SOFTWARE\Policies\Google\Chrome`
3. Добавьте значение:
   ```
   {extension_id};file:///C:/path/to/Auto-Vote-Rating.crx
   ```

**Linux (через `/etc/opt/chrome/policies/`):**
```json
{
  "ExtensionInstallForcelist": [
    "{extension_id};file:///path/to/Auto-Vote-Rating.crx"
  ]
}
```

⚠️ **Примечание:** `extension_id` можно получить из установленного расширения в `chrome://extensions/`

---

### 🔍 Альтернатива: Используйте Edge

Microsoft Edge более лоялен к сторонним расширениям:

1. Откройте `edge://extensions/`
2. Включите "Режим разработчика"
3. Перетащите `.crx` файл на страницу
4. Нажмите "Установить"

⚠️ **Может работать не всегда**, зависит от версии Edge.

---

### 💡 Рекомендация:

**Для обычных пользователей:**
- Используйте **Решение 1** (распаковка .crx как .zip)
- Или скачайте сразу `.zip` файл вместо `.crx`

**Для разработчиков:**
- Используйте **Решение 1** для ежедневной разработки
- `.crx` файл полезен для тестирования упаковки перед публикацией

**Для системных администраторов:**
- Используйте **Решение 4** (Enterprise Policy) для массового развертывания

---

## 🔧 Обслуживание

### Обновление версии перед релизом

1. Обновите версию в `manifest.json`:
   ```json
   {
     "version": "7.3.0"
   }
   ```

2. Закоммитьте изменения:
   ```bash
   git add manifest.json
   git commit -m "Bump version to 7.3.0"
   git push
   ```

3. Создайте тег:
   ```bash
   git tag v7.3.0
   git push origin v7.3.0
   ```

### Просмотр артефактов

- **Build artifacts:** Actions → Build Extension → Latest run → Artifacts
- **Releases:** Releases tab на GitHub

---

## ⚠️ Примечания

- Артефакты из build workflow хранятся **90 дней**
- Релизы хранятся **бессрочно**
- Версия в `manifest.json` должна совпадать с тегом релиза
- Changelog генерируется автоматически из коммитов между релизами
