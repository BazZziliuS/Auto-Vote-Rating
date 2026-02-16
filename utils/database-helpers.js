/**
 * Вспомогательные функции для работы с IndexedDB
 */

/**
 * Обновляет значение в хранилище и отправляет уведомление об изменении
 * @async
 * @param {IDBPDatabase} db - База данных
 * @param {string} storeName - Имя хранилища ('projects', 'other')
 * @param {Object} value - Значение для обновления (должно содержать поле key)
 * @returns {Promise<boolean>} true если обновление успешно
 */
async function updateStoreValue(db, storeName, value) {
    const store = db.transaction(storeName, 'readwrite').store
    const found = await store.count(value.key)

    if (!found) {
        console.warn('The ' + storeName + ' could not be found, it may have been deleted', JSON.stringify(value))
        return false
    }

    await store.put(value, value.key)

    // Отправляем сообщение об изменении
    try {
        await chrome.runtime.sendMessage({updateValue: storeName, value})
    } catch (error) {
        if (!error.message.includes('Could not establish connection. Receiving end does not exist') &&
            !error.message.includes('The message port closed before a response was received')) {
            console.error(error.message)
        }
    }

    return true
}

/**
 * Сохраняет несколько значений в хранилище 'other'
 * @async
 * @param {IDBPDatabase} db - База данных
 * @param {Object} values - Объект с парами ключ-значение для сохранения
 * @returns {Promise<void>}
 */
async function saveMultipleToOther(db, values) {
    const transaction = db.transaction('other', 'readwrite')
    const store = transaction.objectStore('other')

    for (const [key, value] of Object.entries(values)) {
        await store.put(value, key)
    }
}

/**
 * Загружает несколько значений из хранилища 'other'
 * @async
 * @param {IDBPDatabase} db - База данных
 * @param {string[]} keys - Массив ключей для загрузки
 * @returns {Promise<Object>} Объект с загруженными значениями
 */
async function loadMultipleFromOther(db, keys) {
    const transaction = db.transaction('other')
    const store = transaction.objectStore('other')
    const result = {}

    for (const key of keys) {
        result[key] = await store.get(key)
    }

    return result
}

/**
 * Получает все проекты для конкретного рейтинга
 * @async
 * @param {IDBPDatabase} db - База данных
 * @param {string} rating - Название рейтинга
 * @returns {Promise<Array>} Массив проектов
 */
async function getProjectsByRating(db, rating) {
    const projects = []
    let cursor = await db.transaction('projects').objectStore('projects').index('rating').openCursor(rating)

    while (cursor) {
        projects.push(cursor.value)
        cursor = await cursor.continue()
    }

    return projects
}

/**
 * Обновляет проект в базе данных
 * @async
 * @param {IDBPDatabase} db - База данных
 * @param {Object} project - Объект проекта для обновления
 * @param {IDBObjectStoreCursor} [cursor] - Курсор для обновления (если есть)
 * @returns {Promise<void>}
 */
async function updateProject(db, project, cursor = null) {
    if (cursor) {
        await cursor.update(project)
    } else {
        await updateStoreValue(db, 'projects', project)
    }
}

/**
 * Удаляет все значения из хранилища
 * @async
 * @param {IDBPDatabase} db - База данных
 * @param {string} storeName - Имя хранилища
 * @returns {Promise<void>}
 */
async function clearStore(db, storeName) {
    await db.transaction(storeName, 'readwrite').objectStore(storeName).clear()
}

/**
 * Проверяет существование записи в хранилище
 * @async
 * @param {IDBPDatabase} db - База данных
 * @param {string} storeName - Имя хранилища
 * @param {*} key - Ключ для проверки
 * @returns {Promise<boolean>} true если запись существует
 */
async function recordExists(db, storeName, key) {
    const count = await db.transaction(storeName).objectStore(storeName).count(key)
    return count > 0
}
