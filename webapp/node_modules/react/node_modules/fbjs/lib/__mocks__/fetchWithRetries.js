/**
 * Copyright (c) 2013-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @noflow
 */

'use strict';

var Deferred = require.requireActual('../Deferred');

function fetchWithRetries() {
  var deferred = new Deferred();

  for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
    args[_key] = arguments[_key];
  }

  fetchWithRetries.mock.calls.push(args);
  fetchWithRetries.mock.deferreds.push(deferred);
  return deferred.getPromise();
}

fetchWithRetries.mock = {
  calls: [],
  deferreds: []
};

module.exports = fetchWithRetries;