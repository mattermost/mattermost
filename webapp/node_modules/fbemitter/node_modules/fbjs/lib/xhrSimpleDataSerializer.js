'use strict';

/**
 * Copyright (c) 2013-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 */

function xhrSimpleDataSerializer(data) {
  var uri = [];
  var key;
  for (key in data) {
    uri.push(encodeURIComponent(key) + '=' + encodeURIComponent(data[key]));
  }
  return uri.join('&');
}

module.exports = xhrSimpleDataSerializer;