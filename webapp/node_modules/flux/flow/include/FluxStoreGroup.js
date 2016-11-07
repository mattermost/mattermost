/**
 * Copyright (c) 2014-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule FluxStoreGroup
 * @flow
 */

'use strict';

import type Dispatcher from 'Dispatcher';
import type FluxStore from 'FluxStore';

var invariant = require('invariant');

type DispatchToken = string;
type Payload = Object;

/**
 * FluxStoreGroup allows you to execute a callback on every dispatch after
 * waiting for each of the given stores.
 */
class FluxStoreGroup {
  _dispatcher: Dispatcher;
  _dispatchToken: DispatchToken;

  constructor(stores: Array<FluxStore>, callback: Function): void {
    this._dispatcher = _getUniformDispatcher(stores);

    // precompute store tokens
    var storeTokens = stores.map(store => store.getDispatchToken());

    // register with the dispatcher
    this._dispatchToken = this._dispatcher.register(payload => {
      this._dispatcher.waitFor(storeTokens);
      callback();
    });
  }

  release(): void {
    this._dispatcher.unregister(this._dispatchToken);
  }
}

function _getUniformDispatcher(stores: Array<FluxStore>): Dispatcher {
  invariant(
    stores && stores.length,
    'Must provide at least one store to FluxStoreGroup'
  );
  var dispatcher = stores[0].getDispatcher();
  if (__DEV__) {
    for (var store of stores) {
      invariant(
        store.getDispatcher() === dispatcher,
        'All stores in a FluxStoreGroup must use the same dispatcher'
      );
    }
  }
  return dispatcher;
}

module.exports = FluxStoreGroup;
