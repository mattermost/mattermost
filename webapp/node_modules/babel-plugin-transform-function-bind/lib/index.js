/*istanbul ignore next*/"use strict";

exports.__esModule = true;

exports.default = function ( /*istanbul ignore next*/_ref) {
  /*istanbul ignore next*/var t = _ref.types;

  function getTempId(scope) {
    var id = scope.path.getData("functionBind");
    if (id) return id;

    id = scope.generateDeclaredUidIdentifier("context");
    return scope.path.setData("functionBind", id);
  }

  function getStaticContext(bind, scope) {
    var object = bind.object || bind.callee.object;
    return scope.isStatic(object) && object;
  }

  function inferBindContext(bind, scope) {
    var staticContext = getStaticContext(bind, scope);
    if (staticContext) return staticContext;

    var tempId = getTempId(scope);
    if (bind.object) {
      bind.callee = t.sequenceExpression([t.assignmentExpression("=", tempId, bind.object), bind.callee]);
    } else {
      bind.callee.object = t.assignmentExpression("=", tempId, bind.callee.object);
    }
    return tempId;
  }

  return {
    inherits: require("babel-plugin-syntax-function-bind"),

    visitor: { /*istanbul ignore next*/
      CallExpression: function CallExpression(_ref2) {
        /*istanbul ignore next*/var node = _ref2.node;
        /*istanbul ignore next*/var scope = _ref2.scope;

        var bind = node.callee;
        if (!t.isBindExpression(bind)) return;

        var context = inferBindContext(bind, scope);
        node.callee = t.memberExpression(bind.callee, t.identifier("call"));
        node.arguments.unshift(context);
      },
      /*istanbul ignore next*/BindExpression: function BindExpression(path) {
        /*istanbul ignore next*/var node = path.node;
        /*istanbul ignore next*/var scope = path.scope;

        var context = inferBindContext(node, scope);
        path.replaceWith(t.callExpression(t.memberExpression(node.callee, t.identifier("bind")), [context]));
      }
    }
  };
};

/*istanbul ignore next*/module.exports = exports["default"];