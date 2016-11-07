"use strict";

var Promise = require("./Promise");

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

var resolvedPromise = Promise.resolve();

/**
 * An alternative to setImmediate based on Promise.
 */
function resolveImmediate(callback) {
  resolvedPromise.then(callback)["catch"](throwNext);
}

function throwNext(error) {
  setTimeout(function () {
    throw error;
  }, 0);
}

module.exports = resolveImmediate;