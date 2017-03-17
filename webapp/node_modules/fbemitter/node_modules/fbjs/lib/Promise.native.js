/**
 *
 * Copyright 2013-2016 Facebook, Inc.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * This module wraps and augments the minimally ES6-compliant Promise
 * implementation provided by the promise npm package.
 *
 */

'use strict';

var Promise = require('promise/setimmediate/es6-extensions');
require('promise/setimmediate/done');

/**
 * Handle either fulfillment or rejection with the same callback.
 */
Promise.prototype['finally'] = function (onSettled) {
  return this.then(onSettled, onSettled);
};

module.exports = Promise;