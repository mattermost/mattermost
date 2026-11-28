// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Syntax helpers shared by the spec rules (e2e-*) and the webapp testid rules (testid-*).

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

export function stringValue(node) {
    if (node.type === 'Literal') {
        return node.value;
    }
    return node.quasis[0].value.cooked ?? node.quasis[0].value.raw;
}

/** Wrappers that do not change an expression's value: TypeScript casts and non-null assertions. */
export const TS_CASTS = new Set(['TSAsExpression', 'TSNonNullExpression', 'TSSatisfiesExpression', 'TSTypeAssertion']);

const WRAPPERS = new Set(['ChainExpression', ...TS_CASTS]);

/** Whether a node type is a wrapper `unwrap` peels (a TypeScript cast or an optional chain). */
export function isWrapper(type) {
    return WRAPPERS.has(type);
}

/** The expression a wrapper (`x!`, `x as T`, `a?.b()`) stands for. */
export function unwrap(node) {
    let inner = node;
    while (inner && WRAPPERS.has(inner.type)) {
        inner = inner.expression;
    }
    return inner;
}

/** The expression inside TypeScript casts (`x as const`, `x!`); unlike `unwrap`, an optional chain stays. */
export function unwrapCasts(node) {
    let n = node;
    while (n && TS_CASTS.has(n.type)) {
        n = n.expression;
    }
    return n;
}
