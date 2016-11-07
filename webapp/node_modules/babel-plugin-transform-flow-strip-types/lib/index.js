"use strict";

exports.__esModule = true;

var _getIterator2 = require("babel-runtime/core-js/get-iterator");

var _getIterator3 = _interopRequireDefault(_getIterator2);

exports.default = function (_ref) {
  var t = _ref.types;

  var FLOW_DIRECTIVE = "@flow";

  return {
    inherits: require("babel-plugin-syntax-flow"),

    visitor: {
      Program: function Program(path, _ref2) {
        var comments = _ref2.file.ast.comments;

        for (var _iterator = comments, _isArray = Array.isArray(_iterator), _i = 0, _iterator = _isArray ? _iterator : (0, _getIterator3.default)(_iterator);;) {
          var _ref3;

          if (_isArray) {
            if (_i >= _iterator.length) break;
            _ref3 = _iterator[_i++];
          } else {
            _i = _iterator.next();
            if (_i.done) break;
            _ref3 = _i.value;
          }

          var comment = _ref3;

          if (comment.value.indexOf(FLOW_DIRECTIVE) >= 0) {
            comment.value = comment.value.replace(FLOW_DIRECTIVE, "");

            if (!comment.value.replace(/\*/g, "").trim()) comment.ignore = true;
          }
        }
      },
      Flow: function Flow(path) {
        path.remove();
      },
      ClassProperty: function ClassProperty(path) {
        path.node.variance = null;
        path.node.typeAnnotation = null;
        if (!path.node.value) path.remove();
      },
      Class: function Class(path) {
        path.node.implements = null;

        path.get("body.body").forEach(function (child) {
          if (child.isClassProperty()) {
            child.node.typeAnnotation = null;
            if (!child.node.value) child.remove();
          }
        });
      },
      Function: function Function(_ref4) {
        var node = _ref4.node;

        for (var i = 0; i < node.params.length; i++) {
          var param = node.params[i];
          param.optional = false;
        }
      },
      TypeCastExpression: function TypeCastExpression(path) {
        var node = path.node;

        do {
          node = node.expression;
        } while (t.isTypeCastExpression(node));
        path.replaceWith(node);
      }
    }
  };
};

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

module.exports = exports["default"];