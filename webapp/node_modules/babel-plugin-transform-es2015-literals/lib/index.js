/*istanbul ignore next*/"use strict";

exports.__esModule = true;

exports.default = function () {
  return {
    visitor: { /*istanbul ignore next*/
      NumericLiteral: function NumericLiteral(_ref) {
        /*istanbul ignore next*/var node = _ref.node;

        // number octal like 0b10 or 0o70
        if (node.extra && /^0[ob]/i.test(node.extra.raw)) {
          node.extra = undefined;
        }
      },
      /*istanbul ignore next*/StringLiteral: function StringLiteral(_ref2) {
        /*istanbul ignore next*/var node = _ref2.node;

        // unicode escape
        if (node.extra && /\\[u]/gi.test(node.extra.raw)) {
          node.extra = undefined;
        }
      }
    }
  };
};

/*istanbul ignore next*/module.exports = exports["default"];