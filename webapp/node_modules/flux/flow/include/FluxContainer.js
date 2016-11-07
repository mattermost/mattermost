/**
 * Copyright (c) 2014-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule FluxContainer
 * @flow
 */
'use strict';

var FluxStoreGroup = require('FluxStoreGroup');

var invariant = require('invariant');
var shallowEqual = require('shallowEqual');

type Options = {
  pure?: ?boolean,
  withProps?: ?boolean,
};

var DEFAULT_OPTIONS = {
  pure: true,
  withProps: false,
};

/**
 * A FluxContainer is used to subscribe a react component to multiple stores.
 * The stores that are used must be returned from a static `getStores()` method.
 *
 * The component receives information from the stores via state. The state
 * is generated using a static `calculateState()` method that each container
 * must implement. A simple container may look like:
 */
function create<DefaultProps, Props, State>(
  Base: any,
  options?: ?Options,
): ReactClass<DefaultProps, Props, State> {
  enforceInterface(Base);

  // Construct the options using default, override with user values as necessary
  var realOptions = {
    ...DEFAULT_OPTIONS,
    ...(options || {}),
  };

  class FluxContainerClass extends Base {
    _fluxContainerStoreGroup: FluxStoreGroup;
    _fluxContainerSubscriptions: Array<{remove: Function}>;

    constructor(props: any) {
      super(props);
      this.state = realOptions.withProps
        ? Base.calculateState(null, props)
        : Base.calculateState(null, undefined);
    }

    componentDidMount(): void {
      if (super.componentDidMount) {
        super.componentDidMount();
      }

      var stores = Base.getStores();

      // This tracks when any store has changed and we may need to update.
      var changed = false;
      var setChanged = () => {changed = true;};

      // This adds subscriptions to stores. When a store changes all we do is
      // set changed to true.
      this._fluxContainerSubscriptions = stores.map(
        store => store.addListener(setChanged)
      );

      // This callback is called after the dispatch of the relevant stores. If
      // any have reported a change we update the state, then reset changed.
      var callback = () => {
        if (changed) {
          this.setState(prevState => {
            return realOptions.withProps
              ? Base.calculateState(prevState, this.props)
              : Base.calculateState(prevState, undefined);
          });
        }
        changed = false;
      };
      this._fluxContainerStoreGroup = new FluxStoreGroup(stores, callback);
    }

    componentWillReceiveProps(nextProps: any, nextContext: any): void {
      if (super.componentWillReceiveProps) {
        super.componentWillReceiveProps(nextProps, nextContext);
      }

      // Don't do anything else if the container is not configured to use props
      if (!realOptions.withProps) {
        return;
      }

      // If it's pure we can potentially optimize out the calculate state
      if (realOptions.pure && shallowEqual(this.props, nextProps)) {
        return;
      }

      // Finally update the state using the new props
      this.setState(prevState => Base.calculateState(prevState, nextProps));
    }

    componentWillUnmount(): void {
      if (super.componentWillUnmount) {
        super.componentWillUnmount();
      }

      this._fluxContainerStoreGroup.release();
      for (var subscription of this._fluxContainerSubscriptions) {
        subscription.remove();
      }
      this._fluxContainerSubscriptions = [];
    }
  }

  // Make sure we override shouldComponentUpdate only if the pure option is
  // specified. We can't override this above because we don't want to override
  // the default behavior on accident. Super works weird with react ES6 classes
  // right now
  var container = realOptions.pure
    ? createPureContainer(FluxContainerClass)
    : (FluxContainerClass: any);

  // Update the name of the container before returning
  var componentName = Base.displayName || Base.name;
  container.displayName = 'FluxContainer(' + componentName + ')';

  return container;
}

// TODO: typecheck this better
function createPureContainer(FluxContainerBase: any): any {
  class PureFluxContainerClass extends FluxContainerBase {
    shouldComponentUpdate(nextProps: any, nextState: any): boolean {
      return (
        !shallowEqual(this.props, nextProps) ||
        !shallowEqual(this.state, nextState)
      );
    }
  }
  return PureFluxContainerClass;
}

function enforceInterface(o: any): void {
  invariant(
    o.getStores,
    'Components that use FluxContainer must implement `static getStores()`'
  );
  invariant(
    o.calculateState,
    'Components that use FluxContainer must implement `static calculateState()`'
  );
}

module.exports = {create};
