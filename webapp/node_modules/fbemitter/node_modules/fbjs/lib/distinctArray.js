'use strict';

/**
 * Copyright (c) 2013-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * 
 */

var Set = require('./Set');

/**
 * Returns the distinct elements of an iterable. The result is an array whose
 * elements are ordered by first occurrence.
 */
function distinctArray(xs) {
  return Array.from(new Set(xs).values());
}

module.exports = distinctArray;