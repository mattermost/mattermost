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

var enumerate = require('./enumerate');

/**
 * Checks if two iterables are equal. A custom areEqual function may be provided
 * as an optional third argument.
 */
function equalsIterable(one, two, areEqual) {
  if (one === two) {
    return true;
  }

  // We might be able to short circuit by using the size or length fields.
  var oneSize = maybeGetSize(one);
  var twoSize = maybeGetSize(two);
  if (oneSize != null && twoSize != null && oneSize !== twoSize) {
    return false;
  }

  // Otherwise use the iterators to check equality. Here we cannot use for-of
  // because we need to advance the iterators at the same time.
  var oneIterator = enumerate(one);
  var oneItem = oneIterator.next();
  var twoIterator = enumerate(two);
  var twoItem = twoIterator.next();
  var safeAreEqual = areEqual || referenceEquality;
  while (!(oneItem.done || twoItem.done)) {
    if (!safeAreEqual(oneItem.value, twoItem.value)) {
      return false;
    }
    oneItem = oneIterator.next();
    twoItem = twoIterator.next();
  }
  return oneItem.done === twoItem.done;
}

function maybeGetSize(o) {
  if (o == null) {
    return null;
  }
  if (typeof o.size === 'number') {
    return o.size;
  }
  if (typeof o.length === 'number') {
    return o.length;
  }
  return null;
}

function referenceEquality(one, two) {
  return one === two;
}

module.exports = equalsIterable;