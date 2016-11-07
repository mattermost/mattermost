/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule isEmpty
 */

/*eslint-disable no-unused-vars */

/**
 * Mimics empty from PHP.
 */
'use strict';

function isEmpty(obj) {
  if (Array.isArray(obj)) {
    return obj.length === 0;
  } else if (typeof obj === 'object') {
    for (var i in obj) {
      return false;
    }
    return true;
  } else {
    return !obj;
  }
}

module.exports = isEmpty;