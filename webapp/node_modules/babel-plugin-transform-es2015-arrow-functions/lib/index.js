/*istanbul ignore next*/"use strict";

exports.__esModule = true;

exports.default = function ( /*istanbul ignore next*/_ref) {
  /*istanbul ignore next*/var t = _ref.types;

  return {
    visitor: { /*istanbul ignore next*/
      ArrowFunctionExpression: function ArrowFunctionExpression(path, state) {
        if (state.opts.spec) {
          /*istanbul ignore next*/var node = path.node;

          if (node.shadow) return;

          node.shadow = { this: false };
          node.type = "FunctionExpression";

          var boundThis = t.thisExpression();
          boundThis._forceShadow = path;

          // make sure that arrow function won't be instantiated
          path.ensureBlock();
          path.get("body").unshiftContainer("body", t.expressionStatement(t.callExpression(state.addHelper("newArrowCheck"), [t.thisExpression(), boundThis])));

          path.replaceWith(t.callExpression(t.memberExpression(node, t.identifier("bind")), [t.thisExpression()]));
        } else {
          path.arrowFunctionToShadowed();
        }
      }
    }
  };
};

/*istanbul ignore next*/module.exports = exports["default"];