/*istanbul ignore next*/"use strict";

exports.__esModule = true;

exports.default = function () {
  return {
    visitor: { /*istanbul ignore next*/
      RegExpLiteral: function RegExpLiteral(path) {
        /*istanbul ignore next*/var node = path.node;

        if (!regex.is(node, "y")) return;

        path.replaceWith(t.newExpression(t.identifier("RegExp"), [t.stringLiteral(node.pattern), t.stringLiteral(node.flags)]));
      }
    }
  };
};

var /*istanbul ignore next*/_babelHelperRegex = require("babel-helper-regex");

/*istanbul ignore next*/
var regex = _interopRequireWildcard(_babelHelperRegex);

var /*istanbul ignore next*/_babelTypes = require("babel-types");

/*istanbul ignore next*/
var t = _interopRequireWildcard(_babelTypes);

/*istanbul ignore next*/
function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

module.exports = exports["default"];