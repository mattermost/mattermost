// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable no-template-curly-in-string -- messages and cases quote template-literal syntax */

import {
    constInit,
    isPassThroughName,
    isStringLiteral,
    OPTIONS_SCHEMA,
    propKinds,
    testIdKind,
    testIdValueNode,
    unwrapCasts,
    valueLeaves,
} from './testid-utils.js';

// A testid passed down from a testid prop or scope is fine (`data-testid={props.testId}`), and so is one built with
// the testid helpers (`part(testIdScope, 'close', 'button')`); one made entirely of runtime data is not
// (`data-testid={setting.key}`, `data-testid={props.id}`): its scope and name must be literal in the source. Every
// branch that can render is checked.

function hasLiteralPart(context, leaf) {
    switch (leaf.type) {
    case 'Literal':
        return typeof leaf.value === 'string' || leaf.value === null;
    case 'TemplateLiteral':
        return leaf.quasis.some((q) => (q.value.cooked ?? q.value.raw).length > 0);
    case 'BinaryExpression':
        return hasLiteralPart(context, leaf.left) || hasLiteralPart(context, leaf.right);
    case 'Identifier': {
        if (leaf.name === 'undefined') {
            return true;
        }
        const init = unwrapCasts(constInit(context, leaf));
        return Boolean(init && (isStringLiteral(init) || init.type === 'TemplateLiteral') && hasLiteralPart(context, init));
    }
    default:
        return false;
    }
}

export default {
    meta: {
        type: 'problem',
        docs: {
            description: 'Disallow testids made entirely of runtime data; the scope and name must be literal',
        },
        schema: OPTIONS_SCHEMA,
    },
    create: (context) => {
        const kindOf = propKinds(context.options[0]);
        const check = (node) => {
            if (!testIdKind(node, kindOf)) {
                return;
            }
            const value = testIdValueNode(node);
            if (!value) {
                return;
            }
            for (const leaf of valueLeaves(value)) {
                if (!hasLiteralPart(context, leaf) && !isPassThroughName(leaf)) {
                    context.report({
                        node: leaf,
                        message: 'testid is made entirely of runtime data. Write the scope and name as literals and put the data in the key (`scope.name:${value}--role`), or pass it down from a prop named testId/testIdScope.',
                    });
                }
            }
        };
        return {
            JSXAttribute: check,
            Property: check,
        };
    },
};
