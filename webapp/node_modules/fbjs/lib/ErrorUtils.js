/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ErrorUtils
 */

/* jslint unused:false */

"use strict";

var ErrorUtils = {
  applyWithGuard: function (callback, context, args, onError, name) {
    return callback.apply(context, args);
  },
  guard: function (callback, name) {
    return callback;
  }
};

module.exports = ErrorUtils;