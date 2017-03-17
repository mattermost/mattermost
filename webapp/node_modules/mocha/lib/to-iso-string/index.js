'use strict';

/**
 * Pad a `number` with a ten's place zero.
 *
 * @param {number} number
 * @return {string}
 */
function pad(number) {
  var n = number.toString();
  return n.length === 1 ? '0' + n : n;
}

/**
 * Turn a `date` into an ISO string.
 *
 * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/toISOString
 *
 * @param {Date} date
 * @return {string}
 */
function toISOString(date) {
  return date.getUTCFullYear()
    + '-' + pad(date.getUTCMonth() + 1)
    + '-' + pad(date.getUTCDate())
    + 'T' + pad(date.getUTCHours())
    + ':' + pad(date.getUTCMinutes())
    + ':' + pad(date.getUTCSeconds())
    + '.' + String((date.getUTCMilliseconds()/1000).toFixed(3)).slice(2, 5)
    + 'Z';
}

/*
 * Exports.
 */

module.exports = toISOString;
