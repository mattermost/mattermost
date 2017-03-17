"use strict";

var _keys = require("babel-runtime/core-js/object/keys");

var _keys2 = _interopRequireDefault(_keys);

var _babelTypes = require("babel-types");

var t = _interopRequireWildcard(_babelTypes);

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var hasOwn = Object.prototype.hasOwnProperty;

exports.hoist = function (funPath) {
  t.assertFunction(funPath.node);

  var vars = {};

  function varDeclToExpr(vdec, includeIdentifiers) {
    t.assertVariableDeclaration(vdec);

    var exprs = [];

    vdec.declarations.forEach(function (dec) {
      vars[dec.id.name] = t.identifier(dec.id.name);

      if (dec.init) {
        exprs.push(t.assignmentExpression("=", dec.id, dec.init));
      } else if (includeIdentifiers) {
        exprs.push(dec.id);
      }
    });

    if (exprs.length === 0) return null;

    if (exprs.length === 1) return exprs[0];

    return t.sequenceExpression(exprs);
  }

  funPath.get("body").traverse({
    VariableDeclaration: {
      exit: function exit(path) {
        var expr = varDeclToExpr(path.node, false);
        if (expr === null) {
          path.remove();
        } else {
          path.replaceWith(t.expressionStatement(expr));
        }

        path.skip();
      }
    },

    ForStatement: function ForStatement(path) {
      var init = path.node.init;
      if (t.isVariableDeclaration(init)) {
        path.get("init").replaceWith(varDeclToExpr(init, false));
      }
    },

    ForXStatement: function ForXStatement(path) {
      var left = path.get("left");
      if (left.isVariableDeclaration()) {
        left.replaceWith(varDeclToExpr(left.node, true));
      }
    },

    FunctionDeclaration: function FunctionDeclaration(path) {
      var node = path.node;
      vars[node.id.name] = node.id;

      var assignment = t.expressionStatement(t.assignmentExpression("=", node.id, t.functionExpression(node.id, node.params, node.body, node.generator, node.expression)));

      if (path.parentPath.isBlockStatement()) {
        path.parentPath.unshiftContainer("body", assignment);

        path.remove();
      } else {
        path.replaceWith(assignment);
      }

      path.skip();
    },

    FunctionExpression: function FunctionExpression(path) {
      path.skip();
    }
  });

  var paramNames = {};
  funPath.get("params").forEach(function (paramPath) {
    var param = paramPath.node;
    if (t.isIdentifier(param)) {
      paramNames[param.name] = param;
    } else {}
  });

  var declarations = [];

  (0, _keys2.default)(vars).forEach(function (name) {
    if (!hasOwn.call(paramNames, name)) {
      declarations.push(t.variableDeclarator(vars[name], null));
    }
  });

  if (declarations.length === 0) {
    return null;
  }

  return t.variableDeclaration("var", declarations);
};