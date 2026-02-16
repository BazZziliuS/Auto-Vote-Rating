/**
 * Console interceptor для логирования всех сообщений в IndexedDB
 */

/* Store the original log functions. */
console._log = console.log
console._info = console.info
console._warn = console.warn
console._error = console.error
console._debug = console.debug

/* Redirect all calls to the collector. */
console.log = function () {
    return console._intercept('log', arguments)
}
console.info = function () {
    return console._intercept('info', arguments)
}
console.warn = function () {
    return console._intercept('warn', arguments)
}
console.error = function () {
    return console._intercept('error', arguments)
}
console.debug = function () {
    return console._intercept('debug', arguments)
}

/* Give the developer the ability to intercept the message before letting
   console-history access it. */
console._intercept = function (type, args) {
    // Your own code can go here, but the preferred method is to override this
    // function in your own script, and add the line below to the end or
    // begin of your own 'console._intercept' function.
    // REMEMBER: Use only underscore console commands inside _intercept!
    console._collect(type, args)
}

console._collect = function (type, args) {
    const time = new Date().toLocaleString().replace(',', '')

    if (!type) type = 'log'

    if (!args || args.length === 0) return

    console['_' + type].apply(console, args)

    let log = '[' + time + ' ' + type.toUpperCase() + ']:'

    for (let arg of args) {
        if (arg?.stack) {
            log += ' ' + arg.stack
        } else {
            if (typeof arg != 'string') arg = JSON.stringify(arg)
            log += ' ' + arg
        }
    }

    if (dbLogs) dbLogs.add('logs', log)
}
