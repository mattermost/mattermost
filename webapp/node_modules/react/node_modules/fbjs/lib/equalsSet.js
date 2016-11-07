/**
 * Copyright (c) 2013-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * 
 * @typechecks
 */

'use strict';

var everySet = require('./everySet');

/**
 * Checks if two sets are equal
 */
function equalsSet(one, two) {
  if (one.size !== two.size) {
    return false;
  }
  return everySet(one, function (value) {
    return two.has(value);
  });
}

module.exports = equalsSet;