// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Shared syntactic utilities for testid attributes, properties and template branches.

/**
 * The props and object properties that carry a testid, by name or by `/regex/`. `full` values may end in a role
 * (`a.b--button`); `path` values may not, because the component appends its own role.
 */
export const DEFAULT_PROPS = {
    'data-testid': 'full',
    dataTestId: 'full',
    testId: 'path',
    testIdScope: 'path',
    '/^[a-z]\\w*TestId$/': 'full',
    '/^[a-z]\\w*TestIdScope$/': 'path',
};

export const OPTIONS_SCHEMA = [{
    type: 'object',
    properties: {
        props: {
            type: 'object',
            additionalProperties: {enum: ['full', 'path']},
        },
    },
    additionalProperties: false,
}];

/** A value passed down from a testid prop or scope (`props.testId`, `testIdScope`, `HINT_TOAST_TESTID`). */
export const PASS_THROUGH = /(^|\.)\w*(test_?id|scope)$/i;

/** Returns `(name) => kind | null` for the rule's `props` option (exact names first, then the regexes). */
export function propKinds(options) {
    const props = (options && options.props) || DEFAULT_PROPS;
    const exact = new Map();
    const patterns = [];
    for (const [name, kind] of Object.entries(props)) {
        if (name.startsWith('/') && name.lastIndexOf('/') > 0) {
            const end = name.lastIndexOf('/');
            patterns.push([new RegExp(name.slice(1, end), name.slice(end + 1)), kind]);
        } else {
            exact.set(name, kind);
        }
    }
    return (name) => {
        if (exact.has(name)) {
            return exact.get(name);
        }
        const hit = patterns.find(([re]) => re.test(name));
        return hit ? hit[1] : null;
    };
}

/** The testid kind of a JSX attribute or object-literal property, or null when it doesn't carry a testid. */
export function testIdKind(node, kindOf) {
    if (node.type === 'JSXAttribute') {
        return node.name.type === 'JSXIdentifier' ? kindOf(node.name.name) : null;
    }
    if (node.type === 'Property' && !node.computed && node.parent.type === 'ObjectExpression') {
        let key = null;
        if (node.key.type === 'Identifier') {
            key = node.key.name;
        } else if (node.key.type === 'Literal') {
            key = String(node.key.value);
        }
        return key === null ? null : kindOf(key);
    }
    return null;
}

export function testIdValueNode(attrOrProp) {
    const v = attrOrProp.value;
    if (!v) {
        return null;
    }
    if (v.type === 'JSXExpressionContainer') {
        return v.expression.type === 'JSXEmptyExpression' ? null : v.expression;
    }
    return v;
}

/**
 * The expressions a value can render: every branch of `?:`, both sides of `||` and `??`, the right side of
 * `&&` (the left is the guard), through TypeScript casts.
 */
export function valueLeaves(node, out = []) {
    switch (node.type) {
    case 'ConditionalExpression':
        valueLeaves(node.consequent, out);
        valueLeaves(node.alternate, out);
        break;
    case 'LogicalExpression':
        if (node.operator !== '&&') {
            valueLeaves(node.left, out);
        }
        valueLeaves(node.right, out);
        break;
    case 'TSAsExpression':
    case 'TSNonNullExpression':
    case 'TSSatisfiesExpression':
    case 'TSTypeAssertion':
    case 'ParenthesizedExpression':
        valueLeaves(node.expression, out);
        break;
    default:
        out.push(node);
    }
    return out;
}

const CASTS = new Set(['TSAsExpression', 'TSNonNullExpression', 'TSSatisfiesExpression', 'TSTypeAssertion']);

/** The expression inside TypeScript casts (`x as const`, `x!`). */
export function unwrapCasts(node) {
    let n = node;
    while (n && CASTS.has(n.type)) {
        n = n.expression;
    }
    return n;
}

/** `undefined` or `null`: a branch that renders no testid. */
export function isNothing(node) {
    return (node.type === 'Identifier' && node.name === 'undefined') || (node.type === 'Literal' && node.value === null);
}

/** `a.b.c` for identifiers and member chains, or null. */
export function nameOf(expr) {
    if (expr.type === 'Identifier') {
        return expr.name;
    }
    if (expr.type === 'ThisExpression') {
        return 'this';
    }
    if (expr.type === 'MemberExpression' && !expr.computed && expr.property.type === 'Identifier') {
        const obj = nameOf(expr.object);
        return obj ? `${obj}.${expr.property.name}` : expr.property.name;
    }
    if (expr.type === 'ChainExpression' || expr.type === 'TSNonNullExpression' || expr.type === 'TSAsExpression') {
        return nameOf(expr.expression);
    }
    if (expr.type === 'CallExpression' && expr.arguments.length === 0) {
        return nameOf(expr.callee); // a getter method: `this.testIdScope()`
    }
    return null;
}

export function isPassThroughName(expr) {
    const name = nameOf(expr);
    return Boolean(name && PASS_THROUGH.test(name));
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

/** The initializer of a same-file `const` the identifier refers to, or null. */
export function constInit(context, id) {
    if (id.type !== 'Identifier') {
        return null;
    }
    const v = findVariable(context.sourceCode.getScope(id), id.name);
    const def = v && v.defs.length === 1 ? v.defs[0] : null;
    if (!def || def.type !== 'Variable' || def.parent.kind !== 'const' || def.node.id.type !== 'Identifier' || !def.node.init) {
        return null;
    }
    return def.node.init;
}

export function isStringLiteral(node) {
    return node && ((node.type === 'Literal' && typeof node.value === 'string') || (node.type === 'TemplateLiteral' && node.expressions.length === 0));
}

export function stringValue(node) {
    if (node.type === 'Literal') {
        return node.value;
    }
    return node.quasis[0].value.cooked ?? node.quasis[0].value.raw;
}
