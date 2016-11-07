"use strict";

exports.__esModule = true;
exports.runtimeProperty = runtimeProperty;
exports.isReference = isReference;

var _babelTypes = require("babel-types");

var t = _interopRequireWildcard(_babelTypes);

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function runtimeProperty(name) {
  return t.memberExpression(t.identifier("regeneratorRuntime"), t.identifier(name), false);
}

function isReference(path) {
  return path.isReferenced() || path.parentPath.isAssignmentExpression({ left: path.node });
}