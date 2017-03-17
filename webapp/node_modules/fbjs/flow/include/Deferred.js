/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule Deferred
 * @typechecks
 * @flow
 */

var Promise = require('Promise');

/**
 * Deferred provides a Promise-like API that exposes methods to resolve and
 * reject the Promise. It is most useful when converting non-Promise code to use
 * Promises.
 *
 * If you want to export the Promise without exposing access to the resolve and
 * reject methods, you should export `getPromise` which returns a Promise with
 * the same semantics excluding those methods.
 */
class Deferred<Tvalue, Treason> {
  _settled: boolean;
  _promise: Promise;
  _resolve: (value: Tvalue) => void;
  _reject: (reason: Treason) => void;

  constructor() {
    this._settled = false;
    this._promise = new Promise((resolve, reject) => {
      this._resolve = (resolve: any);
      this._reject = (reject: any);
    });
  }

  getPromise(): Promise {
    return this._promise;
  }

  resolve(value: Tvalue): void {
    this._settled = true;
    this._resolve(value);
  }

  reject(reason: Treason): void {
    this._settled = true;
    this._reject(reason);
  }

  then(): Promise {
    return Promise.prototype.then.apply(this._promise, arguments);
  }

  done(): void {
    Promise.prototype.done.apply(this._promise, arguments);
  }

  isSettled(): boolean {
    return this._settled;
  }
}

module.exports = Deferred;
