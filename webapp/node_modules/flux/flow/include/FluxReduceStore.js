/**
 * Copyright (c) 2014-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule FluxReduceStore
 * @flow
 */

'use strict';

import type Dispatcher from 'Dispatcher';

var FluxStore = require('FluxStore');

var abstractMethod = require('abstractMethod');
var invariant = require('invariant');

class FluxReduceStore<TState> extends FluxStore {

  _state: TState;

  constructor(dispatcher: Dispatcher) {
    super(dispatcher);
    this._state = this.getInitialState();
  }

  /**
   * Getter that exposes the entire state of this store. If your state is not
   * immutable you should override this and not expose _state directly.
   */
  getState(): TState {
    return this._state;
  }

  /**
   * Constructs the initial state for this store. This is called once during
   * construction of the store.
   */
  getInitialState(): TState {
    return abstractMethod('FluxReduceStore', 'getInitialState');
  }

  /**
   * Used to reduce a stream of actions coming from the dispatcher into a
   * single state object
   */
  reduce(state: TState, action: Object): TState {
    return abstractMethod('FluxReduceStore', 'reduce');
  }

  /**
   * Checks if two versions of state are the same. You do not need to override
   * this if your state is immutable.
   */
  areEqual(one: TState, two: TState): boolean {
    return one === two;
  }

  /**
   * Use reduce and track _state instead of using __onDispatch
   */
  __invokeOnDispatch(action: Object): void {
    this.__changed = false;

    // reduce the stream of incoming actions to state, update when necessary
    var startingState = this._state;
    var endingState = this.reduce(startingState, action);

    // This means your ending state should never be undefined
    invariant(
      endingState !== undefined,
      '%s returned undefined from reduce(...), did you forget to return ' +
      'state in the default case? (use null if this was intentional)',
      this.constructor.name
    );

    if (!this.areEqual(startingState, endingState)) {
      this._state = endingState;

      // `__emitChange()` sets `this.__changed` to true and then the actual
      // change will be fired from the emitter at the end of the dispatch, this
      // is required in order to support methods like `hasChanged()`
      this.__emitChange();
    }

    if (this.__changed) {
      this.__emitter.emit(this.__changeEvent);
    }
  }
}

module.exports = FluxReduceStore;
