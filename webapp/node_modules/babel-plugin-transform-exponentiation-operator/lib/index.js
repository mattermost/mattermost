/*istanbul ignore next*/"use strict";

exports.__esModule = true;

exports.default = function ( /*istanbul ignore next*/_ref) {
  /*istanbul ignore next*/var t = _ref.types;

  return {
    inherits: require("babel-plugin-syntax-exponentiation-operator"),

    visitor: /*istanbul ignore next*/(0, _babelHelperBuilderBinaryAssignmentOperatorVisitor2.default)({
      operator: "**",

      /*istanbul ignore next*/build: function build(left, right) {
        return t.callExpression(t.memberExpression(t.identifier("Math"), t.identifier("pow")), [left, right]);
      }
    })
  };
};

var /*istanbul ignore next*/_babelHelperBuilderBinaryAssignmentOperatorVisitor = require("babel-helper-builder-binary-assignment-operator-visitor");

/*istanbul ignore next*/
var _babelHelperBuilderBinaryAssignmentOperatorVisitor2 = _interopRequireDefault(_babelHelperBuilderBinaryAssignmentOperatorVisitor);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

module.exports = exports["default"];