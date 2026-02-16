/**
 * Helper функции для endVote
 */

/**
 * Проверяет и добавляет информацию о неправильном домене в request
 * @param {Object} request - Объект запроса
 * @param {Object} sender - Отправитель сообщения
 * @param {Object} project - Объект проекта
 */
function checkIncorrectDomain(request, sender, project) {
    if (!request.successfully && request.later == null) {
        if (sender?.url || request.url) {
            const url = sender?.url || request.url
            const domain = getDomainWithoutSubdomain(url)
            // Если мы попали не по адресу, ну значит не надо отсылать отчёт об ошибке
            if (domain !== project.rating) {
                request.incorrectDomain = domain
            }
        }
    }
}

/**
 * Закрывает вкладку в зависимости от результата голосования и настроек
 * @param {Object} request - Объект запроса
 * @param {Object} sender - Отправитель сообщения
 * @param {Object} project - Объект проекта
 * @param {Object} settings - Настройки расширения
 */
function closeTabIfNeeded(request, sender, project, settings) {
    if (sender && !request.closedTab) {
        if (!request.successfully && request.later == null) {
            // Закрываем вкладку при ошибке (если настройка включена)
            if (!settings.disableCloseTabsOnError) {
                tryCloseTab(sender.tab.id, project, 0)
            }
        } else {
            // Закрываем вкладку при успехе (если настройка включена)
            if (!settings.disableCloseTabsOnSuccess) {
                tryCloseTab(sender.tab.id, project, 0)
            }
        }
    }
}

/**
 * Находит и возвращает opened проект из openedProjects
 * @param {Map} openedProjects - Map открытых проектов
 * @param {Object} project - Объект проекта для поиска
 * @param {number} timeout - Timeout для создания queued проекта
 * @param {IDBPDatabase} db - База данных
 * @returns {Object|null} Opened проект или null если не найден
 */
function findAndPrepareOpenedProject(openedProjects, project, timeout, db) {
    let opened = null

    for (const [tab, value] of openedProjects) {
        if (project.key === value.key) {
            // Проверка на двойную попытку завершения голосования
            if (!Number.isInteger(tab) && !tab.startsWith('background_') && !tab.startsWith('start_')) {
                console.warn('A double attempt to complete the vote? endVote, has openedProjects', JSON.stringify({request: '...'}), JSON.stringify({sender: '...'}), JSON.stringify(project))
                return null
            }

            // Создаём queued проект
            opened = createQueuedProject(value, timeout, project)
            openedProjects.set('queue_' + opened.key, opened)
            openedProjects.delete(tab)
            db.put('other', openedProjects, 'openedProjects')
            break
        }
    }

    if (!opened) {
        console.warn('A double attempt to complete the vote? endVote, not found openedProjects', JSON.stringify({request: '...'}), JSON.stringify({sender: '...'}), JSON.stringify(project))
    }

    return opened
}

/**
 * Применяет рандомизацию к времени следующего голосования
 * @param {Object} project - Объект проекта
 * @param {number} time - Базовое время (timestamp)
 * @returns {number} Время с примененной рандомизацией
 */
function applyTimeRandomization(project, time) {
    // Пользовательская рандомизация
    if (project.randomize) {
        if (project.randomize.min == null) {
            project.randomize = {}
            project.randomize.min = 0
            project.randomize.max = 43200000 // 12 часов
        }
        return time + Math.floor(Math.random() * (project.randomize.max - project.randomize.min) + project.randomize.min)
    }

    // Рандомизация по умолчанию для TopCraft/McTOP (5-10 минут)
    // Эти рейтинги легко ддосятся от массового автоматического голосования
    const needsDefaultRandomization =
        (project.rating === 'topcraft.ru' ||
         project.rating === 'topcraft.club' ||
         project.rating === 'mctop.su' ||
         (project.rating === 'minecraftrating.ru' && project.listing === 'projects')) &&
        !project.priority &&
        project.timeoutHour == null

    if (needsDefaultRandomization) {
        return time + Math.floor(Math.random() * (TIME.MAX_RANDOMIZATION_DEFAULT - TIME.MIN_RANDOMIZATION_DEFAULT) + TIME.MIN_RANDOMIZATION_DEFAULT)
    }

    return time
}

/**
 * Планирует cleanup очереди и следующую проверку голосования
 * Удаляет queued запись проекта и запускает checkVote через timeout
 * @param {Object} project - Объект проекта
 * @param {Map} openedProjects - Map открытых проектов
 * @param {number} timeout - Время задержки перед cleanup (мс)
 * @param {IDBPDatabase} db - База данных
 * @param {Function} checkVote - Функция проверки голосования
 */
function scheduleQueueCleanup(project, openedProjects, timeout, db, checkVote) {
    async function removeQueue() {
        for (const [tab, value] of openedProjects) {
            if (tab.startsWith?.('queue_') && project.key === value.key) {
                openedProjects.delete(tab)
            }
        }
        db.put('other', openedProjects, 'openedProjects')
        checkVote()
    }

    setTimeout(() => {
        removeQueue()
    }, timeout)

    // TODO мы не можем быть уверены что setTimeout в Service Worker 100% отработает, поэтому мы на всякий случай создаём chrome.alarm
    createSafeAlarm('checkVote', Date.now() + timeout, project)
}
