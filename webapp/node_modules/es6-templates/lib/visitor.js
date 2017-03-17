var assert = require('assert');
var recast = require('recast');
var types = recast.types;
var PathVisitor = types.PathVisitor;
var n = types.namedTypes;
var b = types.builders;

function Visitor() {
  PathVisitor.apply(this, arguments);
}
Visitor.prototype = Object.create(PathVisitor.prototype);
Visitor.prototype.constructor = Visitor;

/**
 * Visits a template literal, replacing it with a series of string
 * concatenations. For example, given:
 *
 *    ```js
 *    `1 + 1 = ${1 + 1}`
 *    ```
 *
 * The following output will be generated:
 *
 *    ```js
 *    "1 + 1 = " + (1 + 1)
 *    ```
 *
 * @param {NodePath} path
 * @returns {AST.Literal|AST.BinaryExpression}
 */
Visitor.prototype.visitTemplateLiteral = function(path) {
  var node = path.node;
  var replacement = b.literal(node.quasis[0].value.cooked);

  for (var i = 1, length = node.quasis.length; i < length; i++) {
    replacement = b.binaryExpression(
      '+',
      b.binaryExpression(
        '+',
        replacement,
        node.expressions[i - 1]
      ),
      b.literal(node.quasis[i].value.cooked)
    );
  }

  return replacement;
};

/**
 * Visits the path wrapping a TaggedTemplateExpression node, which has the form
 *
 *   ```js
 *   htmlEncode `<span id=${id}>${text}</span>`
 *   ```
 *
 * @param {NodePath} path
 * @returns {AST.CallExpression}
 */
Visitor.prototype.visitTaggedTemplateExpression = function(path) {
  var node = path.node;
  var args = [];
  var strings = b.callExpression(
    b.functionExpression(
      null,
      [],
      b.blockStatement([
        b.variableDeclaration(
          'var',
          [
            b.variableDeclarator(
              b.identifier('strings'),
              b.arrayExpression(node.quasi.quasis.map(function(quasi) {
                return b.literal(quasi.value.cooked);
              }))
            )
          ]
        ),
        b.expressionStatement(b.assignmentExpression(
          '=',
          b.memberExpression(b.identifier('strings'), b.identifier('raw'), false),
          b.arrayExpression(node.quasi.quasis.map(function(quasi) {
            return b.literal(quasi.value.raw);
          }))
        )),
        b.returnStatement(b.identifier('strings'))
      ])
    ),
    []
  );

  args.push(strings);
  args.push.apply(args, node.quasi.expressions);

  return b.callExpression(
    node.tag,
    args
  );
};

Visitor.visitor = new Visitor();
module.exports = Visitor;
