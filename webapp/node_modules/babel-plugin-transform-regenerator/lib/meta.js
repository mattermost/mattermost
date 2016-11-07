"use strict";

var _assert = require("assert");

var _assert2 = _interopRequireDefault(_assert);

var _babelTypes = require("babel-types");

var t = _interopRequireWildcard(_babelTypes);

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var m = require("private").makeAccessor();

var hasOwn = Object.prototype.hasOwnProperty;

function makePredicate(propertyName, knownTypes) {
  function onlyChildren(node) {
    t.assertNode(node);

    var result = false;

    function check(child) {
      if (result) {} else if (Array.isArray(child)) {
        child.some(check);
      } else if (t.isNode(child)) {
        _assert2.default.strictEqual(result, false);
        result = predicate(child);
      }
      return result;
    }

    var keys = t.VISITOR_KEYS[node.type];
    if (keys) {
      for (var i = 0; i < keys.length; i++) {
        var key = keys[i];
        var child = node[key];
        check(child);
      }
    }

    return result;
  }

  function predicate(node) {
    t.assertNode(node);

    var meta = m(node);
    if (hasOwn.call(meta, propertyName)) return meta[propertyName];

    if (hasOwn.call(opaqueTypes, node.type)) return meta[propertyName] = false;

    if (hasOwn.call(knownTypes, node.type)) return meta[propertyName] = true;

    return meta[propertyName] = onlyChildren(node);
  }

  predicate.onlyChildren = onlyChildren;

  return predicate;
}

var opaqueTypes = {
  FunctionExpression: true
};

var sideEffectTypes = {
  CallExpression: true,
  ForInStatement: true,
  UnaryExpression: true,
  BinaryExpression: true,
  AssignmentExpression: true,
  UpdateExpression: true,
  NewExpression: true };

var leapTypes = {
  YieldExpression: true,
  BreakStatement: true,
  ContinueStatement: true,
  ReturnStatement: true,
  ThrowStatement: true
};

for (var type in leapTypes) {
  if (hasOwn.call(leapTypes, type)) {
    sideEffectTypes[type] = leapTypes[type];
  }
}

exports.hasSideEffects = makePredicate("hasSideEffects", sideEffectTypes);
exports.containsLeap = makePredicate("containsLeap", leapTypes);