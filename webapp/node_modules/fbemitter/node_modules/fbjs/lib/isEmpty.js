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

'use strict';

/* eslint-disable fb-www/typeof-undefined */
/* eslint-disable no-unused-vars */

var invariant = require('./invariant');

/**
 * Checks if a value is empty.
 */
function isEmpty(value) {
  if (Array.isArray(value)) {
    return value.length === 0;
  } else if (typeof value === 'object') {
    if (value) {
      !(!isIterable(value) || value.size === undefined) ? process.env.NODE_ENV !== 'production' ? invariant(false, 'isEmpty() does not support iterable collections.') : invariant(false) : void 0;
      for (var _ in value) {
        return false;
      }
    }
    return true;
  } else {
    return !value;
  }
}

function isIterable(value) {
  if (typeof Symbol === 'undefined') {
    return false;
  }
  return value[Symbol.iterator];
}

module.exports = isEmpty;