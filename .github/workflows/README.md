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
- Загружает артефакт для скачивания (хранится 90 дней)

**Как использовать:**
1. Сделайте push в одну из веток
2. Перейдите в раздел "Actions" на GitHub
3. Откройте последний workflow run
4. Скачайте артефакт из раздела "Artifacts"

**Формат артефакта:** `Auto-Vote-Rating-{version}-{branch}.zip`

Пример: `Auto-Vote-Rating-7.2.6-dev.zip`

---

### 2. Create Release (`release.yml`)

**Триггеры:**
- Push тега в формате `v*` (например, `v7.2.6`)
- Ручной запуск через GitHub UI с указанием тега

**Что делает:**
- Создаёт zip-архив с расширением
- Генерирует changelog из коммитов
- Создаёт GitHub Release с прикреплённым архивом

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

1. **Скачайте архив:**
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

---

## 🔧 Обслуживание

### Обновление версии перед релизом

1. Обновите версию в `manifest.json`:
   ```json
   "version": "7.3.0"
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
