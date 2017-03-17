"use strict";

/**
 * Copyright (c) 2013-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @typechecks
 * 
 */

/**
 * Returns a flattened array that represents the DFS traversal of the supplied
 * input array. For example:
 *
 *   var deep = ["a", ["b", "c"], "d", {"e": [1, 2]}, [["f"], "g"]];
 *   var flat = flattenArray(deep);
 *   console.log(flat);
 *   > ["a", "b", "c", "d", {"e": [1, 2]}, "f", "g"];
 *
 * @see https://github.com/jonschlinkert/arr-flatten
 * @copyright 2014-2015 Jon Schlinkert
 * @license MIT
 */
function flattenArray(array) {
  var result = [];
  flatten(array, result);
  return result;
}

function flatten(array, result) {
  var length = array.length;
  var ii = 0;

  while (length--) {
    var current = array[ii++];
    if (Array.isArray(current)) {
      flatten(current, result);
    } else {
      result.push(current);
    }
  }
}

module.exports = flattenArray;