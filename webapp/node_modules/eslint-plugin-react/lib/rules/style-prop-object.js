/**
 * @fileoverview Enforce style prop value is an object
 * @author David Petersen
 */
'use strict';

var variableUtil = require('../util/variable');

// ------------------------------------------------------------------------------
// Rule Definition
// ------------------------------------------------------------------------------

module.exports = {
  meta: {
    docs: {
      description: 'Enforce style prop value is an object',
      category: '',
      recommended: false
    },
    schema: []
  },

  create: function(context) {
    /**
     * @param {object} node A Identifier node
     */
    function checkIdentifiers(node) {
      var variable = variableUtil.variablesInScope(context).find(function (item) {
        return item.name === node.name;
      });

      if (!variable || !variable.defs[0] || !variable.defs[0].node.init) {
        return;
      }

      if (variable.defs[0].node.init.type === 'Literal') {
        context.report(node, 'Style prop value must be an object');
      }
    }

    return {
      CallExpression: function(node) {
        if (
          node.callee
          && node.callee.type === 'MemberExpression'
          && node.callee.property.name === 'createElement'
          && node.arguments.length > 1
        ) {
          if (node.arguments[1].type === 'ObjectExpression') {
            var style = node.arguments[1].properties.find(function(property) {
              return property.key && property.key.name === 'style' && !property.computed;
            });
            if (style) {
              if (style.value.type === 'Identifier') {
                checkIdentifiers(style.value);
              } else if (style.value.type === 'Literal' && style.value.value !== null) {
                context.report(style.value, 'Style prop value must be an object');
              }
            }
          }
        }
      },

      JSXAttribute: function(node) {
        if (!node.value || node.name.name !== 'style') {
          return;
        }

        if (
          node.value.type !== 'JSXExpressionContainer'
          || (node.value.expression.type === 'Literal' && node.value.expression.value !== null)
        ) {
          context.report(node, 'Style prop value must be an object');
        } else if (node.value.expression.type === 'Identifier') {
          checkIdentifiers(node.value.expression);
        }
      }
    };
  }
};
