'use strict';

/**
 * Copyright (c) 2013-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @typechecks
 */

var push = Array.prototype.push;

/**
 * Applies a function to every item in an array and concatenates the resulting
 * arrays into a single flat array.
 *
 * @param {array} array
 * @param {function} fn
 * @return {array}
 */
function flatMapArray(array, fn) {
  var ret = [];
  for (var ii = 0; ii < array.length; ii++) {
    var result = fn.call(array, array[ii], ii);
    if (Array.isArray(result)) {
      push.apply(ret, result);
    } else if (result != null) {
      throw new TypeError('flatMapArray: Callback must return an array or null, ' + 'received "' + result + '" instead');
    }
  }
  return ret;
}

module.exports = flatMapArray;