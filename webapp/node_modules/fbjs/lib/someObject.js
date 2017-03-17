/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule someObject
 * 
 * @typechecks
 */

'use strict';

var hasOwnProperty = Object.prototype.hasOwnProperty;

/**
 * Executes the provided `callback` once for each enumerable own property in the
 * object until it finds one where callback returns a truthy value. If such a
 * property is found, `someObject` immediately returns true. Otherwise, it
 * returns false.
 *
 * The `callback` is invoked with three arguments:
 *
 *  - the property value
 *  - the property name
 *  - the object being traversed
 *
 * Properties that are added after the call to `someObject` will not be
 * visited by `callback`. If the values of existing properties are changed, the
 * value passed to `callback` will be the value at the time `someObject`
 * visits them. Properties that are deleted before being visited are not
 * visited.
 */
function someObject(object, callback, context) {
  for (var name in object) {
    if (hasOwnProperty.call(object, name)) {
      if (callback.call(context, object[name], name, object)) {
        return true;
      }
    }
  }
  return false;
}

module.exports = someObject;