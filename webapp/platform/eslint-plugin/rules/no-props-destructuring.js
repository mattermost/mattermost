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
        fixable: "code", // Mark as auto-fixable
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

        // Helper to fix destructured props
        function fixDestructuring(fixer, node, firstParam) {
            const sourceCode = context.getSourceCode();
            const paramText = sourceCode.getText(firstParam);
            const newParamText = 'props';
            
            // Get all the destructured properties
            const properties = firstParam.properties || [];
            const fixes = [
                // Replace the destructured parameter with 'props'
                fixer.replaceText(firstParam, newParamText)
            ];
            
            // For each destructured property, replace its usage in the function body
            properties.forEach(prop => {
                if (prop.key && prop.key.name) {
                    const propName = prop.key.name;
                    const localName = prop.value ? prop.value.name : propName;
                    
                    // Find all references to this property in the function body
                    const scope = context.getScope();
                    const variable = scope.variables.find(v => v.name === localName);
                    
                    if (variable) {
                        variable.references.forEach(ref => {
                            if (ref.identifier.parent && ref.identifier.parent.type !== 'MemberExpression') {
                                fixes.push(fixer.replaceText(ref.identifier, `props.${propName}`));
                            }
                        });
                    }
                }
            });
            
            return fixes;
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
                            message: "Props should not be destructured in functional components. Use props.propName instead.",
                            fix: fixer => fixDestructuring(fixer, node, firstParam)
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
                                message: "Props should not be destructured in functional components. Use props.propName instead.",
                                fix: fixer => fixDestructuring(fixer, node, firstParam)
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
                                message: "Props should not be destructured in functional components. Use props.propName instead.",
                                fix: fixer => fixDestructuring(fixer, node, firstParam)
                            });
                        }
                    }
                }
            }
        };
    }
};
