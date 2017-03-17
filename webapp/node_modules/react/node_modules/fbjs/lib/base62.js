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

var BASE62 = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

function base62(number) {
  if (!number) {
    return '0';
  }
  var string = '';
  while (number > 0) {
    string = BASE62[number % 62] + string;
    number = Math.floor(number / 62);
  }
  return string;
}

module.exports = base62;