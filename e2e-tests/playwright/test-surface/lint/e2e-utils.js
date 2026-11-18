// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Syntax helpers for the literal-locator rule.

export function isStringLiteral(node) {
    return Boolean(node) && ((node.type === 'Literal' && typeof node.value === 'string') || (node.type === 'TemplateLiteral' && node.expressions.length === 0));
}

function findVariable(scope, name) {
    for (let s = scope; s; s = s.upper) {
        const v = s.set.get(name);
        if (v) {
            return v;
        }
    }
    return null;
}

/** The initializer of the same-file `const` an identifier refers to, or null. */
export function constInit(context, node) {
    if (!node || node.type !== 'Identifier') {
        return null;
    }
    const v = findVariable(context.sourceCode.getScope(node), node.name);
    const def = v && v.defs.length === 1 ? v.defs[0] : null;
    if (!def || def.type !== 'Variable' || def.parent.kind !== 'const' || def.node.id.type !== 'Identifier' || !def.node.init) {
        return null;
    }
    return def.node.init;
}

/** A property of an object-literal argument, by name. */
export function objectProperty(node, name) {
    if (!node || node.type !== 'ObjectExpression') {
        return null;
    }
    return node.properties.find((p) => p.type === 'Property' && !p.computed && ((p.key.type === 'Identifier' && p.key.name === name) || (p.key.type === 'Literal' && p.key.value === name))) ?? null;
}
