// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

const astUtils = require('jsx-ast-utils')
const getElementType = require('eslint-plugin-jsx-a11y/lib/util/getElementType')

module.exports =  {
    meta: {
        docs: {
            description: 'Enforce all anchors with target="_blank" to use ExternalLink component',
        },
    },
    create: (context) => {
        const elementType = getElementType(context);
        return {
            JSXOpeningElement: (node) => {
                const { attributes } = node;
                const typeCheck = 'a';
                const nodeType = elementType(node);
                // Only check anchor elements
                if (!nodeType || typeCheck !== nodeType) {
                    return;
                }

                const propsToValidate = ['target'];
                const values = propsToValidate.map((prop) => astUtils.getPropValue(astUtils.getProp(node.attributes, prop)));
                // Checks if the target attribute is set to _blank (ie, is an external link)
                const hasBlankTarget = values.some((value) => value != null && value === '_blank');

                // When there is no target value at all, this rule does not apply:
                if (!hasBlankTarget) {
                    return;
                }

                context.report({
                    node,
                    message: 'Use ExternalLink component (components/external_link) for _blank target link-outs',
                });
                return
            },
        };
    },
};
