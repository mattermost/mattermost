"use strict";

exports.__esModule = true;

exports.default = function (_ref) {
  var t = _ref.types;

  var visitor = {
    JSXOpeningElement: function JSXOpeningElement(_ref2) {
      var node = _ref2.node;

      var id = t.jSXIdentifier(TRACE_ID);
      var trace = t.thisExpression();

      node.attributes.push(t.jSXAttribute(id, t.jSXExpressionContainer(trace)));
    }
  };

  return {
    visitor: visitor
  };
};

/**
 * This adds a __self={this} JSX attribute to all JSX elements, which React will use
 * to generate some runtime warnings.
 *
 *
 * == JSX Literals ==
 *
 * <sometag />
 *
 * becomes:
 *
 * <sometag __self={this} />
 */

var TRACE_ID = "__self";

module.exports = exports["default"];