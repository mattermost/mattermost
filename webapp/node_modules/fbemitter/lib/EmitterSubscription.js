/**
 * Copyright (c) 2014-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 * 
 * @providesModule EmitterSubscription
 * @typechecks
 */

'use strict';

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

function _inherits(subClass, superClass) { if (typeof superClass !== 'function' && superClass !== null) { throw new TypeError('Super expression must either be null or a function, not ' + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var EventSubscription = require('./EventSubscription');

/**
 * EmitterSubscription represents a subscription with listener and context data.
 */

var EmitterSubscription = (function (_EventSubscription) {
  _inherits(EmitterSubscription, _EventSubscription);

  /**
   * @param {EventSubscriptionVendor} subscriber - The subscriber that controls
   *   this subscription
   * @param {function} listener - Function to invoke when the specified event is
   *   emitted
   * @param {*} context - Optional context object to use when invoking the
   *   listener
   */

  function EmitterSubscription(subscriber, listener, context) {
    _classCallCheck(this, EmitterSubscription);

    _EventSubscription.call(this, subscriber);
    this.listener = listener;
    this.context = context;
  }

  return EmitterSubscription;
})(EventSubscription);

module.exports = EmitterSubscription;