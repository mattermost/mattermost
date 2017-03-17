/*istanbul ignore next*/"use strict";

exports.__esModule = true;

exports.default = function () {
  return {
    visitor: {
      "ArrowFunctionExpression|FunctionExpression": { /*istanbul ignore next*/
        exit: function exit(path) {
          if (path.key !== "value" && !path.parentPath.isObjectProperty()) {
            var replacement = /*istanbul ignore next*/(0, _babelHelperFunctionName2.default)(path);
            if (replacement) path.replaceWith(replacement);
          }
        }
      },

      /*istanbul ignore next*/ObjectProperty: function ObjectProperty(path) {
        var value = path.get("value");
        if (value.isFunction()) {
          var newNode = /*istanbul ignore next*/(0, _babelHelperFunctionName2.default)(value);
          if (newNode) value.replaceWith(newNode);
        }
      }
    }
  };
};

var /*istanbul ignore next*/_babelHelperFunctionName = require("babel-helper-function-name");

/*istanbul ignore next*/
var _babelHelperFunctionName2 = _interopRequireDefault(_babelHelperFunctionName);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

module.exports = exports["default"];