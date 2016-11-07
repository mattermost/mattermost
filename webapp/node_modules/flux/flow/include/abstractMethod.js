/**
 * Copyright (c) 2014-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule abstractMethod
 * @flow
 */

'use strict';

var invariant = require('invariant');

function abstractMethod<T>(className: string, methodName: string): T {
  invariant(
    false,
     'Subclasses of %s must override %s() with their own implementation.',
     className,
     methodName
   );
}

module.exports = abstractMethod;
