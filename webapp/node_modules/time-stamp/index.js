/*!
 * time-stamp <https://github.com/jonschlinkert/time-stamp>
 *
 * Copyright (c) 2015, Jon Schlinkert.
 * Licensed under the MIT License.
 */

'use strict';

/**
 * Parse the given pattern and return a formatted
 * timestamp.
 *
 * @param  {String} `pattern` Date pattern.
 * @param  {Date} `date` Date object.
 * @return {String}
 */

module.exports = function timestamp(pattern, date) {
  if (typeof pattern !== 'string') {
    date = pattern;
    pattern = 'YYYY:MM:DD';
  }
  date = date || new Date();
  return pattern.replace(/([YMDHms]{2,4})(:\/)?/g, function(_, key, sep) {
    var increment = method(key);
    if (!increment) return _;
    sep = sep || '';

    var res = '00' + String(date[increment[0]]() + (increment[2] || 0));
    return res.slice(-increment[1]) + sep;
  });
};

function method(key) {
  return ({
   YYYY: ['getFullYear', 4],
   YY: ['getFullYear', 2],
   // getMonth is zero-based, thus the extra increment field
   MM: ['getMonth', 2, 1],
   DD: ['getDate', 2],
   HH: ['getHours', 2],
   mm: ['getMinutes', 2],
   ss: ['getSeconds', 2],
   ms: ['getMilliseconds', 3]
  })[key];
}
