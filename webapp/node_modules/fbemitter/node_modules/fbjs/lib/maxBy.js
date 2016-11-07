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

var minBy = require('./minBy');

var compareNumber = function compareNumber(a, b) {
  return a - b;
};

/**
 * Returns the maximum element as measured by a scoring function f. Returns the
 * first such element if there are ties.
 */
function maxBy(as, f, compare) {
  compare = compare || compareNumber;

  return minBy(as, f, function (u, v) {
    return compare(v, u);
  });
}

module.exports = maxBy;