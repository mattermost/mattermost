/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 */

'use strict';

var ErrorUtils = jest.genMockFromModule('../ErrorUtils');

ErrorUtils.applyWithGuard.mockImplementation(function (callback, context, args) {
  return callback.apply(context, args);
});

ErrorUtils.guard.mockImplementation(function (callback) {
  return callback;
});

module.exports = ErrorUtils;