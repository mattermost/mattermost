// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * ensureFeatureFlag() restarts the Testcontainers Mattermost server (the only way to
 * change a feature flag — see e2e-tests/playwright/lib/src/server/feature_flags.ts),
 * and a restart costs roughly a minute. A spec file calling it once per test, with
 * different flags/values across tests, can restart the server many times over for a
 * single file.
 *
 * This rule keeps that cost to at most one restart per spec file by requiring every
 * ensureFeatureFlag call to live in a single top-level test.beforeAll(), never inside
 * an individual test() body (or any other hook). A file whose tests genuinely need
 * different flag combinations should split those tests into their own spec files,
 * each with its own single beforeAll — not call ensureFeatureFlag per test.
 */

function isEnsureFeatureFlagCall(node) {
    const callee = node.callee;
    if (callee.type === 'Identifier' && callee.name === 'ensureFeatureFlag') {
        return true;
    }
    if (
        callee.type === 'MemberExpression' &&
        !callee.computed &&
        callee.property.type === 'Identifier' &&
        callee.property.name === 'ensureFeatureFlag'
    ) {
        return true;
    }
    return false;
}

// Collects the property names of a (possibly chained) MemberExpression callee, e.g.
// `test.describe.configure` -> ['describe', 'configure'], rooted at an Identifier.
function calleeChain(node) {
    const names = [];
    let current = node;
    while (current.type === 'MemberExpression') {
        if (current.property.type === 'Identifier') {
            names.unshift(current.property.name);
        }
        current = current.object;
    }
    if (current.type !== 'Identifier') {
        return null;
    }
    return {root: current.name, names};
}

// Classifies a CallExpression callee as the Playwright test API construct it invokes,
// or null if it isn't recognized as one. Only the shapes relevant to this rule are
// distinguished; anything test.only/fixme/skip/step-like is folded into 'test' since
// it still runs as (or within) an individual test body.
function classifyTestApiCall(calleeNode) {
    const chain = calleeChain(calleeNode);
    if (!chain || chain.root !== 'test') {
        return null;
    }
    if (chain.names.length === 0) {
        return 'test';
    }
    if (chain.names.includes('beforeAll')) {
        return 'beforeAll';
    }
    if (chain.names.includes('beforeEach')) {
        return 'beforeEach';
    }
    if (chain.names.includes('afterEach')) {
        return 'afterEach';
    }
    if (chain.names.includes('afterAll')) {
        return 'afterAll';
    }
    if (chain.names.includes('describe')) {
        return 'describe';
    }
    return 'test';
}

// Walks up from `node` to find the nearest enclosing function that is itself passed
// directly as an argument to a recognized Playwright test API call, and returns what
// kind of hook/body that call represents (e.g. 'beforeAll', 'test'), or null if none
// is found (e.g. module-level code).
function findEnclosingTestApiContext(node) {
    let current = node.parent;
    while (current) {
        const isFunction = current.type === 'FunctionExpression' || current.type === 'ArrowFunctionExpression';
        if (isFunction) {
            const parent = current.parent;
            if (parent && parent.type === 'CallExpression' && parent.arguments.includes(current)) {
                const kind = classifyTestApiCall(parent.callee);
                if (kind) {
                    return kind;
                }
            }
        }
        current = current.parent;
    }
    return null;
}

export default {
    meta: {
        type: 'problem',
        docs: {
            description:
                'Require ensureFeatureFlag to be called at most once per Playwright spec file, from a top-level test.beforeAll()',
        },
        schema: [],
        messages: {
            multipleCalls:
                'ensureFeatureFlag is called {{count}} times in this spec file. Only one call is allowed per file, in a single top-level test.beforeAll() — every test in the file is expected to run under that one flag configuration. Extract any test that needs a different combination into its own spec file.',
            wrongLocation:
                'ensureFeatureFlag must be called from a top-level test.beforeAll(), not from {{context}}. Move this call into a single test.beforeAll() at the top of the file, or extract this test into its own spec file if it needs a different flag combination than the rest of the file.',
        },
    },
    create(context) {
        const filename = context.filename ?? context.getFilename();
        if (!(/\.spec\.ts$/).test(filename)) {
            return {};
        }

        const calls = [];

        return {
            CallExpression(node) {
                if (isEnsureFeatureFlagCall(node)) {
                    calls.push(node);
                }
            },
            'Program:exit'() {
                if (calls.length > 1) {
                    for (const call of calls) {
                        context.report({
                            node: call,
                            messageId: 'multipleCalls',
                            data: {count: String(calls.length)},
                        });
                    }
                    return;
                }

                for (const call of calls) {
                    const hookContext = findEnclosingTestApiContext(call);
                    if (hookContext !== 'beforeAll') {
                        context.report({
                            node: call,
                            messageId: 'wrongLocation',
                            data: {context: hookContext ? `test.${hookContext}()` : 'module-level code'},
                        });
                    }
                }
            },
        };
    },
};
