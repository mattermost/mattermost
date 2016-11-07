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
 * 
 */

'use strict';

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

var Promise = require('./Promise');

/**
 * Deferred provides a Promise-like API that exposes methods to resolve and
 * reject the Promise. It is most useful when converting non-Promise code to use
 * Promises.
 *
 * If you want to export the Promise without exposing access to the resolve and
 * reject methods, you should export `getPromise` which returns a Promise with
 * the same semantics excluding those methods.
 */

var Deferred = (function () {
  function Deferred() {
    var _this = this;

    _classCallCheck(this, Deferred);

    this._settled = false;
    this._promise = new Promise(function (resolve, reject) {
      _this._resolve = resolve;
      _this._reject = reject;
    });
  }

  Deferred.prototype.getPromise = function getPromise() {
    return this._promise;
  };

  Deferred.prototype.resolve = function resolve(value) {
    this._settled = true;
    this._resolve(value);
  };

  Deferred.prototype.reject = function reject(reason) {
    this._settled = true;
    this._reject(reason);
  };

  Deferred.prototype.then = function then() {
    return Promise.prototype.then.apply(this._promise, arguments);
  };

  Deferred.prototype.done = function done() {
    Promise.prototype.done.apply(this._promise, arguments);
  };

  Deferred.prototype.isSettled = function isSettled() {
    return this._settled;
  };

  return Deferred;
})();

module.exports = Deferred;