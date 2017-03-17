/**
 * Constants
 */
var SPLITTER = "\n    at "

/**
 * PostCSS helpers
 */
module.exports = {
  sourceString: sourceString,
  message: formatMessage,
  try: tryCatch
}

/**
 * Returns GNU style source
 *
 * @param {Object} source
 */
function sourceString(source) {
  var message = "<css input>"
  if (source) {
    if (source.input && source.input.file) {
      message = source.input.file
    }
    if (source.start) {
      message += ":" + source.start.line + ":" + source.start.column
    }
  }

  return message
}

/**
 * Returns a GNU style message
 *
 * @param  {String} message
 * @param  {Object} source a PostCSS source object
 * @return {String}
 */
function formatMessage(message, source) {
  return sourceString(source) + ": " + message
}

/**
 * Do something and throw an error with enhanced exception (from given source)
 *
 * @param {Function} fn     [description]
 * @param {[type]}   source [description]
 */
function tryCatch(fn, source) {
  try {
    return fn()
  }
  catch (err) {
    err.originalMessage = err.message
    err.message = formatMessage(err.message, source)

    // if source seems interesting, enhance error
    if (typeof source === "object") {
      // add a stack item if something interesting available
      if ((source.input && source.input.file) || source.start) {
        var stack = err.stack.split(SPLITTER)
        var firstStackItem = stack.shift()
        stack.unshift(sourceString(source))
        stack.unshift(firstStackItem)
        err.stack = stack.join(SPLITTER)
      }

      if (source.input && source.input.file) {
        err.fileName = source.input.file
      }
      if (source.start) {
        err.lineNumber = source.start.line
        err.columnNumber = source.start.column
      }
    }

    throw err
  }
}
