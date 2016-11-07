/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 */

'use strict';

/**
 * Rewrites module string literals according to the `_moduleMap` babel option.
 * This allows other npm packages to be published and used directly without
 * being a part of the same build.
 */
function mapModule(context, module) {
  var moduleMap = context.state.opts._moduleMap || {};
  if (moduleMap.hasOwnProperty(module)) {
    return moduleMap[module];
  }
  // Jest understands the haste module system, so leave modules intact.
  if (process.env.NODE_ENV !== 'test') {
    var modulePrefix = context.state.opts._modulePrefix || './';
    return modulePrefix + module;
  }
}

module.exports = function(babel) {
  var t = babel.types;

  /**
   * Transforms `require('Foo')` and `require.requireActual('Foo')`.
   */
  function transformRequireCall(context, call) {
    if (
      !t.isIdentifier(call.callee, {name: 'require'}) &&
      !(
        t.isMemberExpression(call.callee) &&
        t.isIdentifier(call.callee.object, {name: 'require'}) &&
        t.isIdentifier(call.callee.property, {name: 'requireActual'})
      )
    ) {
      return;
    }
    var moduleArg = call.arguments[0];
    if (moduleArg && moduleArg.type === 'Literal') {
      var module = mapModule(context, moduleArg.value);
      if (module) {
        return t.callExpression(
          call.callee,
          [t.literal(module)]
        );
      }
    }
  }

  /**
   * Transforms either individual or chained calls to `jest.dontMock('Foo')`,
   * `jest.mock('Foo')`, and `jest.genMockFromModule('Foo')`.
   */
  function transformJestCall(context, call) {
    if (!t.isMemberExpression(call.callee)) {
      return;
    }
    var object;
    var member = call.callee;
    if (t.isIdentifier(member.object, {name: 'jest'})) {
      object = member.object;
    } else if (t.isCallExpression(member.object)) {
      object = transformJestCall(context, member.object);
    }
    if (!object) {
      return;
    }
    var args = call.arguments;
    if (
      args[0] &&
      args[0].type === 'Literal' &&
      (
        t.isIdentifier(member.property, {name: 'dontMock'}) ||
        t.isIdentifier(member.property, {name: 'mock'}) ||
        t.isIdentifier(member.property, {name: 'genMockFromModule'})
      )
    ) {
      var module = mapModule(context, args[0].value);
      if (module) {
        args = [t.literal(module)];
      }
    }
    return t.callExpression(
      t.memberExpression(object, member.property),
      args
    );
  }

  return new babel.Transformer('fbjs.rewrite-modules', {
    CallExpression: {
      exit: function(node, parent) {
        return (
          transformRequireCall(this, node) ||
          transformJestCall(this, node)
        );
      }
    }
  });
};
