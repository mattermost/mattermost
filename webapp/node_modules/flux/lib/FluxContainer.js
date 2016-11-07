/**
 * Copyright (c) 2014-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule FluxContainer
 * 
 */
'use strict';

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

function _inherits(subClass, superClass) { if (typeof superClass !== 'function' && superClass !== null) { throw new TypeError('Super expression must either be null or a function, not ' + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var FluxStoreGroup = require('./FluxStoreGroup');

var invariant = require('fbjs/lib/invariant');
var shallowEqual = require('fbjs/lib/shallowEqual');

var DEFAULT_OPTIONS = {
  pure: true,
  withProps: false
};

/**
 * A FluxContainer is used to subscribe a react component to multiple stores.
 * The stores that are used must be returned from a static `getStores()` method.
 *
 * The component receives information from the stores via state. The state
 * is generated using a static `calculateState()` method that each container
 * must implement. A simple container may look like:
 */
function create(Base, options) {
  enforceInterface(Base);

  // Construct the options using default, override with user values as necessary
  var realOptions = _extends({}, DEFAULT_OPTIONS, options || {});

  var FluxContainerClass = (function (_Base) {
    _inherits(FluxContainerClass, _Base);

    function FluxContainerClass(props) {
      _classCallCheck(this, FluxContainerClass);

      _Base.call(this, props);
      this.state = realOptions.withProps ? Base.calculateState(null, props) : Base.calculateState(null, undefined);
    }

    // Make sure we override shouldComponentUpdate only if the pure option is
    // specified. We can't override this above because we don't want to override
    // the default behavior on accident. Super works weird with react ES6 classes
    // right now

    FluxContainerClass.prototype.componentDidMount = function componentDidMount() {
      var _this = this;

      if (_Base.prototype.componentDidMount) {
        _Base.prototype.componentDidMount.call(this);
      }

      var stores = Base.getStores();

      // This tracks when any store has changed and we may need to update.
      var changed = false;
      var setChanged = function () {
        changed = true;
      };

      // This adds subscriptions to stores. When a store changes all we do is
      // set changed to true.
      this._fluxContainerSubscriptions = stores.map(function (store) {
        return store.addListener(setChanged);
      });

      // This callback is called after the dispatch of the relevant stores. If
      // any have reported a change we update the state, then reset changed.
      var callback = function () {
        if (changed) {
          _this.setState(function (prevState) {
            return realOptions.withProps ? Base.calculateState(prevState, _this.props) : Base.calculateState(prevState, undefined);
          });
        }
        changed = false;
      };
      this._fluxContainerStoreGroup = new FluxStoreGroup(stores, callback);
    };

    FluxContainerClass.prototype.componentWillReceiveProps = function componentWillReceiveProps(nextProps, nextContext) {
      if (_Base.prototype.componentWillReceiveProps) {
        _Base.prototype.componentWillReceiveProps.call(this, nextProps, nextContext);
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
      this.setState(function (prevState) {
        return Base.calculateState(prevState, nextProps);
      });
    };

    FluxContainerClass.prototype.componentWillUnmount = function componentWillUnmount() {
      if (_Base.prototype.componentWillUnmount) {
        _Base.prototype.componentWillUnmount.call(this);
      }

      this._fluxContainerStoreGroup.release();
      for (var _iterator = this._fluxContainerSubscriptions, _isArray = Array.isArray(_iterator), _i = 0, _iterator = _isArray ? _iterator : _iterator[Symbol.iterator]();;) {
        var _ref;

        if (_isArray) {
          if (_i >= _iterator.length) break;
          _ref = _iterator[_i++];
        } else {
          _i = _iterator.next();
          if (_i.done) break;
          _ref = _i.value;
        }

        var subscription = _ref;

        subscription.remove();
      }
      this._fluxContainerSubscriptions = [];
    };

    return FluxContainerClass;
  })(Base);

  var container = realOptions.pure ? createPureContainer(FluxContainerClass) : FluxContainerClass;

  // Update the name of the container before returning
  var componentName = Base.displayName || Base.name;
  container.displayName = 'FluxContainer(' + componentName + ')';

  return container;
}

// TODO: typecheck this better
function createPureContainer(FluxContainerBase) {
  var PureFluxContainerClass = (function (_FluxContainerBase) {
    _inherits(PureFluxContainerClass, _FluxContainerBase);

    function PureFluxContainerClass() {
      _classCallCheck(this, PureFluxContainerClass);

      _FluxContainerBase.apply(this, arguments);
    }

    PureFluxContainerClass.prototype.shouldComponentUpdate = function shouldComponentUpdate(nextProps, nextState) {
      return !shallowEqual(this.props, nextProps) || !shallowEqual(this.state, nextState);
    };

    return PureFluxContainerClass;
  })(FluxContainerBase);

  return PureFluxContainerClass;
}

function enforceInterface(o) {
  !o.getStores ? process.env.NODE_ENV !== 'production' ? invariant(false, 'Components that use FluxContainer must implement `static getStores()`') : invariant(false) : undefined;
  !o.calculateState ? process.env.NODE_ENV !== 'production' ? invariant(false, 'Components that use FluxContainer must implement `static calculateState()`') : invariant(false) : undefined;
}

module.exports = { create: create };