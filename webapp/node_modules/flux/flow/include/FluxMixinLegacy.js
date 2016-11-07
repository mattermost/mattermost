/**
 * Copyright (c) 2014-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule FluxMixinLegacy
 * @flow
 */

'use strict';

import type * as FluxStore from 'FluxStore';

var FluxStoreGroup = require('FluxStoreGroup');

var invariant = require('invariant');

/**
 * `FluxContainer` should be preferred over this mixin, but it requires using
 * react with classes. So this mixin is provided where it is not yet possible
 * to convert a container to be a class.
 *
 * This mixin should be used for React components that have state based purely
 * on stores. `this.props` will not be available inside of `calculateState()`.
 *
 * This mixin will only `setState` not replace it, so you should always return
 * every key in your state unless you know what you are doing. Consider this:
 *
 *   var Foo = React.createClass({
 *     mixins: [
 *       FluxMixinLegacy([FooStore])
 *     ],
 *
 *     statics: {
 *       calculateState(prevState) {
 *         if (!prevState) {
 *           return {
 *             foo: FooStore.getFoo(),
 *           };
 *         }
 *
 *         return {
 *           bar: FooStore.getBar(),
 *         };
 *       }
 *     },
 *   });
 *
 * On the second calculateState when prevState is not null, the state will be
 * updated to contain the previous foo AND the bar that was just returned. Only
 * returning bar will not delete foo.
 *
 */
function FluxMixinLegacy(stores: Array<FluxStore>): any {
  return {
    getInitialState(): Object {
      enforceInterface(this);
      return this.constructor.calculateState(null);
    },

    componentDidMount(): void {
      // This tracks when any store has changed and we may need to update.
      var changed = false;
      var setChanged = () => {changed = true;};

      // This adds subscriptions to stores. When a store changes all we do is
      // set changed to true.
      this._fluxMixinSubscriptions = stores.map(
        store => store.addListener(setChanged)
      );

      // This callback is called after the dispatch of the relevant stores. If
      // any have reported a change we update the state, then reset changed.
      var callback = () => {
        if (changed) {
          this.setState(
            prevState => this.constructor.calculateState(this.state)
          );
        }
        changed = false;
      };
      this._fluxMixinStoreGroup = new FluxStoreGroup(stores, callback);
    },

    componentWillUnmount(): void {
      this._fluxMixinStoreGroup.release();
      for (var subscription of this._fluxMixinSubscriptions) {
        subscription.remove();
      }
      this._fluxMixinSubscriptions = [];
    },
  };
}

function enforceInterface(o: any): void {
  invariant(
    o.constructor.calculateState,
    'Components that use FluxMixinLegacy must implement ' +
    '`calculateState()` on the statics object'
  );
}

module.exports = FluxMixinLegacy;
