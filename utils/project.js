/**
 * Утилиты для работы с проектами
 */

/**
 * Формирует префикс для проекта в логах
 * @param {Object} project - Объект проекта
 * @param {boolean} detailed - Показывать детальную информацию
 * @returns {string} Форматированный префикс проекта
 */
function getProjectPrefix(project, detailed) {
    let text = ''
    if (project.nick && project.nick !== '') text += ' – ' + project.nick
    if (detailed && project.game && project.game !== '') text += ' – ' + project.game
    if (detailed) {
        if (project.id && project.id !== '') text += ' – ' + project.id
        if (project.name && project.name !== '') text += ' – ' + project.name
    } else {
        if (project.name && project.name !== '') {
            text += ' – ' + project.name
        } else if (project.id && project.id !== '') {
            text += ' – ' + project.id
        }
    }
    if (text === '') {
        return '[' + project.rating + ']'
    } else {
        text = text.replace(' – ', '')
        return '[' + project.rating + '] ' + text
    }
}
