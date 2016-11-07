/*istanbul ignore next*/"use strict";

exports.__esModule = true;

exports.default = function ( /*istanbul ignore next*/_ref) {
  /*istanbul ignore next*/var t = _ref.types;

  function build(node, nodes, scope) {
    var first = node.specifiers[0];
    if (!t.isExportNamespaceSpecifier(first) && !t.isExportDefaultSpecifier(first)) return;

    var specifier = node.specifiers.shift();
    var uid = scope.generateUidIdentifier(specifier.exported.name);

    var newSpecifier = /*istanbul ignore next*/void 0;
    if (t.isExportNamespaceSpecifier(specifier)) {
      newSpecifier = t.importNamespaceSpecifier(uid);
    } else {
      newSpecifier = t.importDefaultSpecifier(uid);
    }

    nodes.push(t.importDeclaration([newSpecifier], node.source));
    nodes.push(t.exportNamedDeclaration(null, [t.exportSpecifier(uid, specifier.exported)]));

    build(node, nodes, scope);
  }

  return {
    inherits: require("babel-plugin-syntax-export-extensions"),

    visitor: { /*istanbul ignore next*/
      ExportNamedDeclaration: function ExportNamedDeclaration(path) {
        /*istanbul ignore next*/var node = path.node;
        /*istanbul ignore next*/var scope = path.scope;

        var nodes = [];
        build(node, nodes, scope);
        if (!nodes.length) return;

        if (node.specifiers.length >= 1) {
          nodes.push(node);
        }
        path.replaceWithMultiple(nodes);
      }
    }
  };
};

/*istanbul ignore next*/module.exports = exports["default"];