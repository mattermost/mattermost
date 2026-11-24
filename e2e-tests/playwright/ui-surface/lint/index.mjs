// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {parseTestId} from '../dist/scan.js';

const PROBE_METHODS = new Set(['isVisible', 'isHidden', 'isChecked', 'isEnabled', 'isDisabled', 'isEditable']);
const POSITIONAL_METHODS = new Set(['first', 'last', 'nth']);
const CSS_SELECTOR_HINT = /^[.#[]/;

function insidePollCallback(node) {
    for (let cur = node.parent; cur; cur = cur.parent) {
        if (cur.type === 'CallExpression' && cur.callee?.type === 'MemberExpression') {
            const prop = cur.callee.property?.name;
            if (prop === 'poll' || prop === 'toPass') {
                return true;
            }
        }
    }
    return false;
}

function isEmptyCatch(block) {
    if (!block || block.body.length === 0) {
        return true;
    }
    return block.body.length === 1 && block.body[0].type === 'ReturnStatement';
}

export const rules = {
    'no-sleeps': {
        meta: {type: 'problem', schema: []},
        create(context) {
            return {
                CallExpression(node) {
                    const callee = node.callee;
                    if (callee.type === 'MemberExpression' && callee.property.name === 'waitForTimeout') {
                        context.report({node, message: 'Avoid waitForTimeout(); assert on UI or API state instead.'});
                    }
                    if (
                        callee.type === 'MemberExpression' &&
                        callee.property.name === 'waitForLoadState' &&
                        node.arguments[0]?.value === 'networkidle'
                    ) {
                        context.report({node, message: 'Avoid waitForLoadState("networkidle"); wait for a specific element or API response.'});
                    }
                    if (callee.type === 'Identifier' && callee.name === 'setTimeout') {
                        context.report({node, message: 'Avoid setTimeout waits in Playwright specs.'});
                    }
                },
            };
        },
    },
    'no-probes': {
        meta: {type: 'problem', schema: []},
        create(context) {
            return {
                CallExpression(node) {
                    if (node.callee.type !== 'MemberExpression') {
                        return;
                    }
                    const name = node.callee.property?.name;
                    if (PROBE_METHODS.has(name) && !insidePollCallback(node)) {
                        context.report({node, message: `Avoid instant probe .${name}() outside expect.poll()/toPass(); use retrying expect() assertions.`});
                    }
                },
            };
        },
    },
    'no-swallowed-catch': {
        meta: {type: 'problem', schema: []},
        create(context) {
            return {
                CallExpression(node) {
                    if (node.callee.type !== 'MemberExpression' || node.callee.property?.name !== 'catch') {
                        return;
                    }
                    const arg = node.arguments[0];
                    if (arg && (arg.type === 'ArrowFunctionExpression' || arg.type === 'FunctionExpression')) {
                        if (arg.body.type !== 'BlockStatement' || isEmptyCatch(arg.body)) {
                            context.report({node, message: 'Do not swallow errors in .catch(); let failures surface or rethrow.'});
                        }
                    }
                },
                CatchClause(node) {
                    if (isEmptyCatch(node.body)) {
                        context.report({node, message: 'Do not swallow errors with an empty or value-only catch block.'});
                    }
                },
            };
        },
    },
    'no-positional-picks': {
        meta: {type: 'suggestion', schema: []},
        create(context) {
            return {
                CallExpression(node) {
                    if (node.callee.type !== 'MemberExpression') {
                        return;
                    }
                    const name = node.callee.property?.name;
                    if (POSITIONAL_METHODS.has(name)) {
                        context.report({node, message: `Avoid positional .${name}() selector picks; use a stable key or unique role/text.`});
                    }
                },
            };
        },
    },
    'no-raw-css-locators': {
        meta: {type: 'suggestion', schema: []},
        create(context) {
            return {
                CallExpression(node) {
                    if (node.callee.type !== 'MemberExpression' || node.callee.property?.name !== 'locator') {
                        return;
                    }
                    const arg = node.arguments[0];
                    if (arg?.type === 'Literal' && typeof arg.value === 'string' && CSS_SELECTOR_HINT.test(arg.value)) {
                        context.report({node, message: `Avoid raw CSS selector "${arg.value}" in locator(); use getByTestId or semantic role locators.`});
                    }
                },
            };
        },
    },
    'testid-grammar': {
        meta: {type: 'problem', schema: []},
        create(context) {
            return {
                JSXAttribute(node) {
                    if (node.name?.name !== 'data-testid' || node.value?.type !== 'Literal' || typeof node.value.value !== 'string') {
                        return;
                    }
                    const raw = node.value.value;
                    if (!raw.includes('--') && !raw.includes('.')) {
                        return;
                    }
                    const parsed = parseTestId(raw);
                    if (!parsed.valid) {
                        context.report({node, message: parsed.error ?? `Invalid testid grammar "${raw}"`});
                    }
                },
            };
        },
    },
};

export default {rules};
