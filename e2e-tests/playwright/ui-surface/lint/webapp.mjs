// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Webapp-side ESLint rules for data-testid hygiene. Pure AST (JSX nodes only) so the webapp lint job can load them
// without the scanner's `typescript` dependency. These give authors local feedback on changed code; the hard,
// repo-wide gate is `ui-surface check` (duplicates/role/key across files) and the testid ratchet (new legacy ids).

function attrs(node) {
    const out = {};
    for (const a of node.attributes ?? []) {
        if (a.type === 'JSXAttribute' && a.name?.type === 'JSXIdentifier') {
            out[a.name.name] = a;
        }
    }
    return out;
}

function literal(attr) {
    const v = attr?.value;
    if (!v) {
        return undefined;
    }
    if (v.type === 'Literal' && typeof v.value === 'string') {
        return v.value;
    }
    if (v.type === 'JSXExpressionContainer' && v.expression?.type === 'Literal' && typeof v.expression.value === 'string') {
        return v.expression.value;
    }
    return undefined;
}

export const rules = {
    'no-duplicate-testid': {
        meta: {type: 'problem', schema: []},
        create(context) {
            const seen = new Map();
            return {
                'JSXOpeningElement'(node) {
                    const id = literal(attrs(node)['data-testid']);
                    if (id === undefined) {
                        return;
                    }
                    if (seen.has(id)) {
                        context.report({node, message: `Duplicate data-testid "${id}" in this file; ids must be unique so a lookup is unambiguous.`});
                    } else {
                        seen.set(id, node);
                    }
                },
            };
        },
    },
    'no-dynamic-testid': {
        meta: {type: 'suggestion', schema: []},
        create(context) {
            return {
                'JSXOpeningElement'(node) {
                    const a = attrs(node);
                    const testid = a['data-testid'];
                    if (!testid) {
                        return;
                    }
                    const value = testid.value;
                    const isLiteral = literal(testid) !== undefined;
                    const hasSurface = Boolean(a['data-surface']);
                    // A dynamic data-testid that is not paired with a typed data-surface cannot be statically resolved.
                    if (!isLiteral && value?.type === 'JSXExpressionContainer' && !hasSurface) {
                        context.report({
                            node,
                            message:
                                'Dynamic data-testid cannot be statically checked; pair it with a data-surface (scope.name:key--role) or make it a literal grammar id.',
                        });
                    }
                },
            };
        },
    },
};

export default {rules};
