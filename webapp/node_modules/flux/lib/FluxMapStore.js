/**
 * Copyright (c) 2014-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule FluxMapStore
 * 
 */

'use strict';

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

function _inherits(subClass, superClass) { if (typeof superClass !== 'function' && superClass !== null) { throw new TypeError('Super expression must either be null or a function, not ' + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var FluxReduceStore = require('./FluxReduceStore');
var Immutable = require('immutable');

var invariant = require('fbjs/lib/invariant');

/**
 * This is a simple store. It allows caching key value pairs. An implementation
 * of a store using this might look like:
 *
 *   class FooStore extends FluxMapStore {
 *     reduce(state, action) {
 *       switch (action.type) {
 *         case 'foo':
 *           return state.set(action.id, action.foo);
 *         case 'bar':
 *           return state.delete(action.id);
 *         default:
 *           return state;
 *       }
 *     }
 *   }
 *
 */

var FluxMapStore = (function (_FluxReduceStore) {
  _inherits(FluxMapStore, _FluxReduceStore);

  function FluxMapStore() {
    _classCallCheck(this, FluxMapStore);

    _FluxReduceStore.apply(this, arguments);
  }

  FluxMapStore.prototype.getInitialState = function getInitialState() {
    return Immutable.Map();
  };

  /**
   * Access the value at the given key. throws an error if the key does not
   * exist in the cache.
   */

  FluxMapStore.prototype.at = function at(key) {
    !this.has(key) ? process.env.NODE_ENV !== 'production' ? invariant(false, 'Expected store to have key %s', key) : invariant(false) : undefined;
    return this.get(key);
  };

  /**
   * Check if the cache has a particular key
   */

  FluxMapStore.prototype.has = function has(key) {
    return this.getState().has(key);
  };

  /**
   * Get the value of a particular key. Returns undefined if the key does not
   * exist in the cache.
   */

  FluxMapStore.prototype.get = function get(key) {
    return this.getState().get(key);
  };

  /**
   * Gets an array of keys and puts the values in a map if they exist, it allows
   * providing a previous result to update instead of generating a new map.
   *
   * Providing a previous result allows the possibility of keeping the same
   * reference if the keys did not change.
   */

  FluxMapStore.prototype.getAll = function getAll(keys, prev) {
    var _this = this;

    var newKeys = Immutable.Set(keys);
    var start = prev || Immutable.Map();
    return start.withMutations(function (map) {
      // remove any old keys that are not in new keys or are no longer in
      // the cache
      for (var _iterator = start, _isArray = Array.isArray(_iterator), _i = 0, _iterator = _isArray ? _iterator : _iterator[Symbol.iterator]();;) {
        var _ref;

        if (_isArray) {
          if (_i >= _iterator.length) break;
          _ref = _iterator[_i++];
        } else {
          _i = _iterator.next();
          if (_i.done) break;
          _ref = _i.value;
        }

        var entry = _ref;
        var oldKey = entry[0];

        if (!newKeys.has(oldKey) || !_this.has(oldKey)) {
          map['delete'](oldKey);
        }
      }

      // then add all of the new keys that exist in the cache
      for (var _iterator2 = newKeys, _isArray2 = Array.isArray(_iterator2), _i2 = 0, _iterator2 = _isArray2 ? _iterator2 : _iterator2[Symbol.iterator]();;) {
        var _ref2;

        if (_isArray2) {
          if (_i2 >= _iterator2.length) break;
          _ref2 = _iterator2[_i2++];
        } else {
          _i2 = _iterator2.next();
          if (_i2.done) break;
          _ref2 = _i2.value;
        }

        var key = _ref2;

        if (_this.has(key)) {
          map.set(key, _this.at(key));
        }
      }
    });
  };

  return FluxMapStore;
})(FluxReduceStore);

module.exports = FluxMapStore;