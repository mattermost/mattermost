/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule removeFromArray
 * @typechecks
 * 
 */

/**
 * Removes an element from an array.
 */
"use strict";

function removeFromArray(array, element) {
  var index = array.indexOf(element);
  if (index !== -1) {
    array.splice(index, 1);
  }
}

module.exports = removeFromArray;