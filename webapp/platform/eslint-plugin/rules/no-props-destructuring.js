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
        fixable: null, // Disable auto-fix for now
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

        // Helper to check if a node is likely a React component
        function isReactComponent(node) {
            // Check for JSX in the function body
            if (node.body) {
                const sourceCode = context.getSourceCode();
                const functionBody = sourceCode.getText(node.body);
                
                // If the function contains JSX, it's likely a React component
                if (functionBody.includes('<') && functionBody.includes('/>')) {
                    return true;
                }
                
                // Check for common React hooks
                if (functionBody.includes('useState') || 
                    functionBody.includes('useEffect') || 
                    functionBody.includes('useRef') || 
                    functionBody.includes('useContext')) {
                    return true;
                }
            }
            
            return false;
        }

        return {
            // Check function declarations that might be components
            FunctionDeclaration(node) {
                if (node.params.length > 0) {
                    const firstParam = node.params[0];
                    if (firstParam.type === "ObjectPattern" && 
                        (isComponentName(node.id.name) || isReactComponent(node))) {
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
                        // or if it contains JSX
                        const parent = node.parent;
                        if ((parent.type === "VariableDeclarator" && isComponentName(parent.id.name)) ||
                            isReactComponent(node)) {
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
                        // or if it contains JSX
                        const parent = node.parent;
                        if ((parent.type === "VariableDeclarator" && isComponentName(parent.id.name)) ||
                            isReactComponent(node)) {
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
