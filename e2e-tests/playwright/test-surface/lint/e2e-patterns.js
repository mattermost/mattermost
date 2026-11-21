// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Spec patterns that hide what a test does, one rule each so every rule has its own message and severity. They match by
// name and shape, not by type, so they also run where a spec has no types. Each can be disabled on a line with a reason
// (`e2e-disable-reason`).
//
// - `e2e-no-probes`: `isVisible()` and its kin read the page once and do not wait.
// - `e2e-no-conditional-logic`: a branch on awaited page state hides which path a test took.
// - `e2e-no-swallowed-catch`: `.catch(() => value)` and an empty `catch` turn a failure into a quiet value.
// - `e2e-no-sleeps`: `waitForTimeout`, `networkidle` and `setTimeout` waits guess at timing.
// - `e2e-no-soft-assertions`: `expect.soft` lets a test go on after it failed.
// - `e2e-no-url-assertions`: where a test is belongs to the page object (`pathFor`, `ready`), not to URL text in a spec.
// - `e2e-no-positional-picks`: `.first()`, `.last()` and `.nth()` name a position, not an item.

const FUNCTION = new Set(['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression']);
const PROBES = new Set(['isVisible', 'isHidden', 'isChecked', 'isEnabled', 'isDisabled', 'isEditable']);

/** The name of the method a call is made on (`a.b.c()` is `c`), or null. */
function methodName(call) {
    const callee = call.callee;
    if (callee.type !== 'MemberExpression' || callee.computed || callee.property.type !== 'Identifier') {
        return null;
    }
    return callee.property.name;
}

/** Whether a call is `expect.poll(...)`. */
function isExpectPoll(call) {
    const callee = call.callee;
    return callee.type === 'MemberExpression' && !callee.computed && callee.object.type === 'Identifier' && callee.object.name === 'expect' && callee.property.name === 'poll';
}

/** Whether a function is the callback of `expect.poll(fn)` or `expect(fn).toPass()`: a place that retries it. */
function retries(fn) {
    const call = fn.parent;
    if (call?.type !== 'CallExpression' || !call.arguments.includes(fn)) {
        return false;
    }
    if (isExpectPoll(call)) {
        return true;
    }
    const outer = call.parent;
    return call.callee.type === 'Identifier' && call.callee.name === 'expect' && outer?.type === 'MemberExpression' && outer.object === call && outer.property.name === 'toPass';
}

/** Whether a node is inside a callback that is retried. */
function inRetryingCallback(context, node) {
    return context.sourceCode.getAncestors(node).some((ancestor) => FUNCTION.has(ancestor.type) && retries(ancestor));
}

/** Whether an expression awaits, not counting what is inside a nested function. */
function containsAwait(context, node) {
    if (!node || typeof node.type !== 'string' || FUNCTION.has(node.type)) {
        return false;
    }
    if (node.type === 'AwaitExpression') {
        return true;
    }
    const keys = context.sourceCode.visitorKeys[node.type] ?? [];
    return keys.some((key) => {
        const value = node[key];
        return Array.isArray(value) ? value.some((child) => containsAwait(context, child)) : containsAwait(context, value);
    });
}

/** Whether a statement list contains a `throw` outside nested functions. */
function throws(context, node) {
    if (!node || typeof node.type !== 'string' || FUNCTION.has(node.type)) {
        return false;
    }
    if (node.type === 'ThrowStatement') {
        return true;
    }
    const keys = context.sourceCode.visitorKeys[node.type] ?? [];
    return keys.some((key) => {
        const value = node[key];
        return Array.isArray(value) ? value.some((child) => throws(context, child)) : throws(context, value);
    });
}

const rule = (description, messages, create) => ({
    meta: {type: 'suggestion', docs: {description}, schema: [], messages},
    create,
});

export const probes = rule(
    'Disallow reading page state once with isVisible and its kin; assert with a retrying expect',
    {probe: '`{{name}}()` reads the page once and does not wait. Assert with a retrying `expect(...)` (`toBeVisible`, `toBeHidden`, `toBeChecked`, `toBeEnabled`, ...) or `expect.poll`; branching on page state hides which path a test took.'},
    (context) => ({
        CallExpression(node) {
            const name = methodName(node);
            if (name && PROBES.has(name) && !inRetryingCallback(context, node)) {
                context.report({node: node.callee.property, messageId: 'probe', data: {name}});
            }
        },
    }),
);

export const conditionalLogic = rule(
    'Disallow branching on awaited page state in a test',
    {conditional: 'A test branches on awaited page state here, so what it ran depends on timing. Know the state the test is in and assert it; only a navigation walk ("get to X from wherever I am") may branch.'},
    (context) => {
        const test = (node) => {
            if (containsAwait(context, node)) {
                context.report({node, messageId: 'conditional'});
            }
        };
        return {
            IfStatement: (node) => test(node.test),
            ConditionalExpression: (node) => test(node.test),
            WhileStatement: (node) => test(node.test),
            DoWhileStatement: (node) => test(node.test),
            ForStatement: (node) => node.test && test(node.test),
            ExpressionStatement(node) {
                if (node.expression.type === 'LogicalExpression' && containsAwait(context, node.expression)) {
                    context.report({node: node.expression, messageId: 'conditional'});
                }
            },
        };
    },
);

export const swallowedCatch = rule(
    'Disallow catching an error to carry on with a quiet value',
    {swallowed: 'This turns a failure into a quiet value. Let it fail, or assert what you expect; a cleanup that may fail needs a reason.'},
    (context) => ({
        CallExpression(node) {
            if (methodName(node) !== 'catch') {
                return;
            }
            const [handler] = node.arguments;
            if (handler && FUNCTION.has(handler.type) && !throws(context, handler.body)) {
                context.report({node, messageId: 'swallowed'});
            }
        },
        CatchClause(node) {
            const quiet = node.body.body.every((statement) => statement.type === 'ReturnStatement' && (!statement.argument || statement.argument.type === 'Literal' || (statement.argument.type === 'Identifier' && statement.argument.name === 'undefined')));
            if (quiet) {
                context.report({node, messageId: 'swallowed'});
            }
        },
    }),
);

export const sleeps = rule(
    'Disallow sleeps and waiting for the network to be idle',
    {
        timeout: '`waitForTimeout` is a guess at timing. Wait for the thing itself: a retrying `expect(...)`, `settle` or `clickTo`.',
        networkidle: '`networkidle` waits for a quiet network, which is not the thing the test needs. Wait for the thing itself: a retrying `expect(...)`, `settle` or `clickTo`.',
        timer: 'A `setTimeout` wait is a guess at timing. Wait for the thing itself: a retrying `expect(...)`, `expect.poll` or `settle`.',
    },
    (context) => ({
        CallExpression(node) {
            const name = methodName(node);
            if (name === 'waitForTimeout') {
                context.report({node: node.callee.property, messageId: 'timeout'});
            } else if (name === 'waitForLoadState' && node.arguments[0]?.type === 'Literal' && node.arguments[0].value === 'networkidle') {
                context.report({node, messageId: 'networkidle'});
            } else if (node.callee.type === 'Identifier' && node.callee.name === 'setTimeout') {
                context.report({node: node.callee, messageId: 'timer'});
            } else if (name === 'setTimeout' && node.callee.object.type === 'Identifier' && ['window', 'globalThis'].includes(node.callee.object.name)) {
                context.report({node: node.callee.property, messageId: 'timer'});
            }
        },
    }),
);

export const softAssertions = rule(
    'Disallow soft assertions',
    {soft: '`expect.soft` lets the test go on after it failed. Use `expect`, so the first failure is the one reported.'},
    (context) => ({
        MemberExpression(node) {
            if (!node.computed && node.object.type === 'Identifier' && node.object.name === 'expect' && node.property.name === 'soft') {
                context.report({node, messageId: 'soft'});
            }
        },
    }),
);

export const urlAssertions = rule(
    'Disallow asserting URL text in a spec; use toBeOn',
    {url: 'Assert where the test is through the page object: `expect(page).toHavePath(app.<page>.pathFor(params))` (subpath-aware), and `app.<page>.ready[0]` visible when the test needs the page rendered. Write `toHaveURL` only where the URL is the subject (a redirect target, a query parameter), with a reason.'},
    (context) => ({
        CallExpression(node) {
            if (methodName(node) === 'toHaveURL') {
                context.report({node: node.callee.property, messageId: 'url'});
            }
        },
    }),
);

export const positionalPicks = rule(
    'Discourage picking an item by position',
    {position: '`.{{name}}()` names a position, which changes when the list does. Reach the item by its key through the generated page objects; if they offer no way, that is a gap to record.'},
    (context) => ({
        CallExpression(node) {
            const name = methodName(node);
            if ((name === 'first' || name === 'last') && node.arguments.length === 0) {
                context.report({node: node.callee.property, messageId: 'position', data: {name}});
            } else if (name === 'nth' && node.arguments.length === 1) {
                context.report({node: node.callee.property, messageId: 'position', data: {name}});
            }
        },
    }),
);
