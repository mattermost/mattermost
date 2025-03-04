/**
 * @fileoverview Rule to disallow destructuring props in functional components
 */

"use strict";

module.exports = {
    meta: {
        type: "suggestion",
        docs: {
            description: "Disallow destructuring props in functional components",
            category: "Best Practices",
            recommended: true
        },
        fixable: null,
        schema: []
    },

    create: function(context) {
        return {
            // Check function declarations that might be components
            FunctionDeclaration(node) {
                if (node.params.length > 0) {
                    const firstParam = node.params[0];
                    if (firstParam.type === "ObjectPattern" && 
                        (node.id.name.match(/^[A-Z]/) || // Component names start with capital letter
                         node.id.name.includes("Component"))) {
                        context.report({
                            node: firstParam,
                            message: "Props should not be destructured in functional components. Use props.propName instead."
                        });
                    }
                }
            },
            // Check arrow functions that might be components
            ArrowFunctionExpression(node) {
                if (node.params.length > 0) {
                    const firstParam = node.params[0];
                    if (firstParam.type === "ObjectPattern") {
                        // Check if this arrow function is assigned to a variable that looks like a component
                        const parent = node.parent;
                        if (parent.type === "VariableDeclarator" && 
                            (parent.id.name.match(/^[A-Z]/) || // Component names start with capital letter
                             parent.id.name.includes("Component"))) {
                            context.report({
                                node: firstParam,
                                message: "Props should not be destructured in functional components. Use props.propName instead."
                            });
                        }
                    }
                }
            }
        };
    }
};
