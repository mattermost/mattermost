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
        // Helper function to check if a name looks like a component
        function isComponentName(name) {
            return name && (
                name.match(/^[A-Z]/) || // Component names start with capital letter
                name.includes("Component")
            );
        }

        return {
            // Check function declarations that might be components
            FunctionDeclaration(node) {
                if (node.params.length > 0) {
                    const firstParam = node.params[0];
                    if (firstParam.type === "ObjectPattern" && isComponentName(node.id.name)) {
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
                        if (parent.type === "VariableDeclarator" && isComponentName(parent.id.name)) {
                            context.report({
                                node: firstParam,
                                message: "Props should not be destructured in functional components. Use props.propName instead."
                            });
                        }
                    }
                }
            },
            // Check function expressions that might be components
            FunctionExpression(node) {
                if (node.params.length > 0) {
                    const firstParam = node.params[0];
                    if (firstParam.type === "ObjectPattern") {
                        // Check if this function is assigned to a variable that looks like a component
                        const parent = node.parent;
                        if (parent.type === "VariableDeclarator" && isComponentName(parent.id.name)) {
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
