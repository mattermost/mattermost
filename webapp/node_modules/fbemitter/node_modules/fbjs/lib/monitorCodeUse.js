/**
 * Copyright 2014-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 */

'use strict';

var invariant = require('./invariant');

/**
 * Provides open-source compatible instrumentation for monitoring certain API
 * uses before we're ready to issue a warning or refactor. It accepts an event
 * name which may only contain the characters [a-z0-9_] and an optional data
 * object with further information.
 */

function monitorCodeUse(eventName, data) {
  !(eventName && !/[^a-z0-9_]/.test(eventName)) ? process.env.NODE_ENV !== 'production' ? invariant(false, 'You must provide an eventName using only the characters [a-z0-9_]') : invariant(false) : void 0;
}

module.exports = monitorCodeUse;