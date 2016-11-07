/**
 * Copyright (c) 2014-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule FluxStore
 * @flow
 */

'use strict';

import type Dispatcher from 'Dispatcher';

var {EventEmitter} = require('fbemitter');
var invariant = require('invariant');

/**
 * This class should be extended by the stores in your application, like so:
 *
 * var FluxStore = require('FluxStore');
 * var MyDispatcher = require('MyDispatcher');
 *
 * var _foo;
 *
 * class MyStore extends FluxStore {
 *
 *   getFoo() {
 *     return _foo;
 *   }
 *
 *   __onDispatch = function(action) {
 *     switch(action.type) {
 *
 *       case 'an-action':
 *         changeState(action.someData);
 *         this.__emitChange();
 *         break;
 *
 *       case 'another-action':
 *         changeStateAnotherWay(action.otherData);
 *         this.__emitChange();
 *         break;
 *
 *       default:
 *         // no op
 *     }
 *   }
 *
 * }
 *
 * module.exports = new MyStore(MyDispatcher);
 */
class FluxStore {

  // private
  _dispatchToken: string;

  // protected, available to subclasses
  __changed: boolean;
  __changeEvent: string;
  __className: any;
  __dispatcher: Dispatcher;
  __emitter: EventEmitter;

  /**
   * @public
   * @param {Dispatcher} dispatcher
   */
  constructor(dispatcher: Dispatcher): void {
    this.__className = this.constructor.name;

    this.__changed = false;
    this.__changeEvent = 'change';
    this.__dispatcher = dispatcher;
    this.__emitter = new EventEmitter();
    this._dispatchToken = dispatcher.register((payload) => {
      this.__invokeOnDispatch(payload);
    });
  }

  /**
   * @public
   * @param {function} callback
   * @return {object} EmitterSubscription that can be used with
   *   SubscriptionsHandler or directly used to release the subscription.
   */
  addListener(callback: (eventType?: string) => void): Object {
    return this.__emitter.addListener(this.__changeEvent, callback);
  }

  /**
   * @public
   * @return {Dispatcher} The dispatcher that this store is registered with.
   */
  getDispatcher(): Dispatcher {
    return this.__dispatcher;
  }

  /**
   * @public
   * @return {string} A string the dispatcher uses to identify each store's
   *   registered callback. This is used with the dispatcher's waitFor method
   *   to declaratively depend on other stores updating themselves first.
   */
  getDispatchToken(): string {
    return this._dispatchToken;
  }

  /**
   * @public
   * @return {boolean} Whether the store has changed during the most recent
   *   dispatch.
   */
  hasChanged(): boolean {
    invariant(
      this.__dispatcher.isDispatching(),
      '%s.hasChanged(): Must be invoked while dispatching.',
      this.__className
    );
    return this.__changed;
  }

  /**
   * @protected
   * Emit an event notifying listeners that the state of the store has changed.
   */
  __emitChange(): void {
    invariant(
      this.__dispatcher.isDispatching(),
      '%s.__emitChange(): Must be invoked while dispatching.',
      this.__className
    );
    this.__changed = true;
  }

  /**
   * This method encapsulates all logic for invoking __onDispatch. It should
   * be used for things like catching changes and emitting them after the
   * subclass has handled a payload.
   *
   * @protected
   * @param {object} payload The data dispatched by the dispatcher, describing
   *   something that has happened in the real world: the user clicked, the
   *   server responded, time passed, etc.
   */
  __invokeOnDispatch(payload: Object): void {
    this.__changed = false;
    this.__onDispatch(payload);
    if (this.__changed) {
      this.__emitter.emit(this.__changeEvent);
    }
  }

  /**
   * The callback that will be registered with the dispatcher during
   * instantiation. Subclasses must override this method. This callback is the
   * only way the store receives new data.
   *
   * @protected
   * @override
   * @param {object} payload The data dispatched by the dispatcher, describing
   *   something that has happened in the real world: the user clicked, the
   *   server responded, time passed, etc.
   */
  __onDispatch(payload: Object): void {
    invariant(
      false,
      '%s has not overridden FluxStore.__onDispatch(), which is required',
      this.__className
    );
  }
}

module.exports = FluxStore;
