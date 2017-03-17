/**
 * Copyright (c) 2014-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule FluxMapStore
 * @flow
 */

'use strict';

import type Dispatcher from 'Dispatcher';

var FluxReduceStore = require('FluxReduceStore');
var Immutable = require('immutable');

var invariant = require('invariant');

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
class FluxMapStore<K, V> extends FluxReduceStore<Immutable.Map<K, V>> {

  getInitialState(): Immutable.Map<K, V> {
    return Immutable.Map();
  }

  /**
   * Access the value at the given key. throws an error if the key does not
   * exist in the cache.
   */
  at(key: K): V {
    invariant(
      this.has(key),
      'Expected store to have key %s',
      key
    );
    return (this.get(key): any);
  }

  /**
   * Check if the cache has a particular key
   */
  has(key: K): boolean {
    return this.getState().has(key);
  }

  /**
   * Get the value of a particular key. Returns undefined if the key does not
   * exist in the cache.
   */
  get(key: K): ?V {
    return this.getState().get(key);
  }

  /**
   * Gets an array of keys and puts the values in a map if they exist, it allows
   * providing a previous result to update instead of generating a new map.
   *
   * Providing a previous result allows the possibility of keeping the same
   * reference if the keys did not change.
   */
  getAll(keys: Iterable<K>, prev?: ?Immutable.Map<K, V>): Immutable.Map<K, V> {
    var newKeys = Immutable.Set(keys);
    var start = prev || Immutable.Map();
    return start.withMutations((map) => {
      // remove any old keys that are not in new keys or are no longer in
      // the cache
      for (var entry of start) {
        var [oldKey] = entry;
        if (!newKeys.has(oldKey) || !this.has(oldKey)) {
          map.delete(oldKey);
        }
      }

      // then add all of the new keys that exist in the cache
      for (var key of newKeys) {
        if (this.has(key)) {
          map.set(key, this.at(key));
        }
      }
    });
  }
}

module.exports = FluxMapStore;
