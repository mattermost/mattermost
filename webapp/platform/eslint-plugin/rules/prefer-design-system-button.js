// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

const getElementType = require('eslint-plugin-jsx-a11y/lib/util/getElementType');

module.exports = {
    meta: {
        docs: {
            description: 'Prefer using design system Button component over native HTML button element',
            recommended: false,
        },
        type: 'suggestion',
        schema: [],
        fixable: null,
    },
    create: (context) => {
        const elementType = getElementType(context);
        const filename = context.getFilename();
        
        return {
            JSXOpeningElement: (node) => {
                const nodeType = elementType(node);
                
                // Only check button elements
                if (!nodeType || nodeType !== 'button') {
                    return;
                }
                
                // Allow native button elements within design system component implementations
                // but still flag them in component library/documentation files
                if (filename.includes('/design_system/') && !filename.includes('/component_library/')) {
                    return;
                }
                
                context.report({
                    node,
                    message: 'Prefer using the design system Button component (components/design_system/button) instead of HTML <button> element for consistency and design system adoption.',
                });
            },
        };
    },
};
