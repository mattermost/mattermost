/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule PromiseMap
 * @flow
 */

'use strict';

var Deferred = require('Deferred');

var invariant = require('invariant');

import type * as Promise from 'Promise';

/**
 * A map of asynchronous values that can be get or set in any order. Unlike a
 * normal map, setting the value for a particular key more than once throws.
 * Also unlike a normal map, a key can either be resolved or rejected.
 */
class PromiseMap<Tvalue, Treason> {
  _deferred: {[key:string]: Deferred};

  constructor() {
    this._deferred = {};
  }

  get(key: string): Promise {
    return getDeferred(this._deferred, key).getPromise();
  }

  resolveKey(key: string, value: Tvalue): void {
    var entry = getDeferred(this._deferred, key);
    invariant(!entry.isSettled(), 'PromiseMap: Already settled `%s`.', key);
    entry.resolve(value);
  }

  rejectKey(key: string, reason: Treason): void {
    var entry = getDeferred(this._deferred, key);
    invariant(!entry.isSettled(), 'PromiseMap: Already settled `%s`.', key);
    entry.reject(reason);
  }
}

function getDeferred(
  entries: {[key: string]: Deferred},
  key: string
): Deferred {
  if (!entries.hasOwnProperty(key)) {
    entries[key] = new Deferred();
  }
  return entries[key];
}

module.exports = PromiseMap;
