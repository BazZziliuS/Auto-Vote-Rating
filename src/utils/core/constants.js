/**
 * Константы расширения
 */

/**
 * Временные интервалы (миллисекунды)
 */
const TIME = {
    /** Минимальная задержка для chrome.alarms (65 секунд) */
    MIN_ALARM_DELAY: 65000,

    /** Задержка перед повторной попыткой операции с вкладками (0.5 секунды) */
    TAB_OPERATION_RETRY_DELAY: 500,

    /** Минимальная рандомизация для TopCraft/McTOP (5 минут) */
    MIN_RANDOMIZATION_DEFAULT: 300000,

    /** Максимальная рандомизация для TopCraft/McTOP (10 минут) */
    MAX_RANDOMIZATION_DEFAULT: 600000,

    /** Задержка ожидания загрузки вкладки (250 мс) */
    TAB_LOAD_CHECK_DELAY: 250,

    /** Рандомизация задержки для проектов (10-60 секунд) */
    MIN_PROJECT_RANDOMIZATION: 10000,
    MAX_PROJECT_RANDOMIZATION: 60000,

    /** Рандомизация для randomize проектов (30-60 минут) */
    MIN_RANDOMIZE_COOLDOWN: 1800000,
    MAX_RANDOMIZE_COOLDOWN: 2400000,

    /** Рандомизация для ошибок (до 15 минут) */
    MAX_ERROR_RANDOMIZATION: 900000,

    /** Cooldown для 404 ошибки (6 часов) */
    ERROR_404_COOLDOWN: 21600000
}

/**
 * Лимиты и счетчики
 */
const LIMITS = {
    /** Максимальное количество попыток inject скрипта */
    MAX_INJECT_ATTEMPTS: 10,

    /** Максимальное количество попыток операций с вкладками */
    MAX_TAB_OPERATION_RETRIES: 3,

    /** Максимальное количество циклов ожидания загрузки вкладки */
    MAX_TAB_LOAD_WAIT_CYCLES: 9,

    /** Задержка для проверки следующей попытки голосования (минуты) */
    ERROR_RETRY_MINUTES: 15
}
