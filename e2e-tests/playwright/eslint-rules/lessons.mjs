// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import playwright from 'eslint-plugin-playwright';

// Lint rules for the "Lessons from master failures" in AGENTS.md (process: docs/lessons.md). They are not part of `npm run lint`:
// many existing files break them. `npm run lint:lessons` (script/lint-lessons-ratchet.mjs) applies
// them only to the files a change touches, and fails when a file breaks a lesson more often than it
// did on the base commit. Each lesson has its own rule, so a new violation of one lesson can't hide
// behind a removed violation of another.

const LOCATOR_METHODS = new Set([
    'locator',
    'frameLocator',
    'getByRole',
    'getByTestId',
    'getByText',
    'getByLabel',
    'getByPlaceholder',
    'getByAltText',
    'getByTitle',
]);

const XPATH = /^(xpath=|\/\/|\(\/\/|\.\.)/;
const XPATH_METHODS = new Set(['locator', 'frameLocator']);

function methodName(node) {
    return node.callee.type === 'MemberExpression' && !node.callee.computed ? node.callee.property.name : null;
}

function firstArgText(node) {
    const arg = node.arguments[0];
    if (!arg) {
        return null;
    }
    if (arg.type === 'Literal' && typeof arg.value === 'string') {
        return arg.value;
    }
    if (arg.type === 'TemplateLiteral') {
        return arg.quasis[0].value.cooked;
    }
    return null;
}

// True when `node` is evaluated as a condition: an if, ternary, loop or logical operand,
// optionally compared for equality first.
const PASS_THROUGH = new Set(['LogicalExpression', 'UnaryExpression', 'AwaitExpression', 'TSNonNullExpression']);
const CONDITIONAL = new Set(['IfStatement', 'ConditionalExpression', 'WhileStatement', 'DoWhileStatement']);
const EQUALITY = new Set(['===', '!==', '==', '!=']);

function passesThrough(parent) {
    return PASS_THROUGH.has(parent.type) || (parent.type === 'BinaryExpression' && EQUALITY.has(parent.operator));
}

function isInCondition(node) {
    let child = node;
    let parent = node.parent;
    while (parent && passesThrough(parent)) {
        child = parent;
        parent = parent.parent;
    }
    return Boolean(parent && CONDITIONAL.has(parent.type) && parent.test === child);
}

const noSpecLocators = {
    meta: {
        type: 'problem',
        docs: {description: 'L-001: specs never build locators'},
        messages: {
            noLocator:
                'L-001: specs never build locators ({{method}}). Add or reuse a member of a page or component object in lib.',
        },
        schema: [],
    },
    create(context) {
        return {
            CallExpression(node) {
                const method = methodName(node);
                if (LOCATOR_METHODS.has(method)) {
                    context.report({node, messageId: 'noLocator', data: {method}});
                }
            },
        };
    },
};

const noXpath = {
    meta: {
        type: 'problem',
        docs: {description: 'L-002: no XPath locators'},
        messages: {
            noXpath: 'L-002: no XPath. Use getByRole with an accessible name, then label or text, then getByTestId.',
        },
        schema: [],
    },
    create(context) {
        return {
            CallExpression(node) {
                if (!XPATH_METHODS.has(methodName(node))) {
                    return;
                }
                const text = firstArgText(node);
                if (text !== null && XPATH.test(text)) {
                    context.report({node, messageId: 'noXpath'});
                }
            },
        };
    },
};

const noUnwaitedIsVisible = {
    meta: {
        type: 'problem',
        docs: {description: "L-007: isVisible() doesn't wait, so don't swallow or branch on it"},
        messages: {
            catch: "L-007: isVisible() doesn't wait. Use a web-first assertion such as toBeVisible() or toBeHidden().",
            branch: "L-007: isVisible() doesn't wait, so branching on it races the page. Wait for the state that decides the branch.",
        },
        schema: [],
    },
    create(context) {
        return {
            CallExpression(node) {
                if (methodName(node) !== 'isVisible') {
                    return;
                }
                const parent = node.parent;
                if (
                    parent.type === 'MemberExpression' &&
                    parent.object === node &&
                    parent.property.name === 'catch' &&
                    parent.parent.type === 'CallExpression'
                ) {
                    context.report({node, messageId: 'catch'});
                } else if (isInCondition(node)) {
                    context.report({node, messageId: 'branch'});
                }
            },
        };
    },
};

// One-shot reads of page state. isVisible() is left to no-unwaited-is-visible (L-007).
const PAGE_STATE_READS = new Set([
    'isHidden',
    'isChecked',
    'isEnabled',
    'isDisabled',
    'isEditable',
    'count',
    'textContent',
    'innerText',
    'inputValue',
    'getAttribute',
]);
const COMPARISON = new Set(['===', '!==', '==', '!=', '<', '<=', '>', '>=']);

// True when `node` decides a branch: an if, ternary or loop condition, through await, !, &&, || and comparisons.
function decidesBranch(node) {
    let child = node;
    let parent = node.parent;
    while (
        parent &&
        (PASS_THROUGH.has(parent.type) || (parent.type === 'BinaryExpression' && COMPARISON.has(parent.operator)))
    ) {
        child = parent;
        parent = parent.parent;
    }
    return Boolean(parent && CONDITIONAL.has(parent.type) && parent.test === child);
}

const noPageStateBranch = {
    meta: {
        type: 'problem',
        docs: {description: 'L-010: tests and page objects take one path; they never branch on what the page shows'},
        messages: {
            branch: "L-010: don't branch on {{method}}(). Branching on page state hides failures: make the state known (set it up or wait for it) and take one path.",
        },
        schema: [],
    },
    create(context) {
        return {
            CallExpression(node) {
                const method = methodName(node);
                if (PAGE_STATE_READS.has(method) && decidesBranch(node)) {
                    context.report({node, messageId: 'branch', data: {method}});
                }
            },
        };
    },
};

const lessons = {
    meta: {name: 'mattermost-e2e-lessons'},
    rules: {
        'no-spec-locators': noSpecLocators,
        'no-xpath': noXpath,
        'no-unwaited-is-visible': noUnwaitedIsVisible,
        'no-page-state-branch': noPageStateBranch,
    },
};

// ESLint flat config for the lesson rules, keyed by lesson id in the comments.
export const lessonsConfig = [
    {
        files: ['**/*.ts'],
        plugins: {playwright, lessons},
        rules: {
            'lessons/no-xpath': 'error', // L-002
            'playwright/no-force-option': 'error', // L-003
            'playwright/no-wait-for-timeout': 'error', // L-007
            'playwright/prefer-web-first-assertions': 'error', // L-007
            'lessons/no-unwaited-is-visible': 'error', // L-007
            'lessons/no-page-state-branch': 'error', // L-010
        },
    },
    {
        files: ['specs/**/*.ts'],
        rules: {
            'lessons/no-spec-locators': 'error', // L-001
        },
    },
];

export const LESSON_RULES = lessonsConfig.flatMap((config) => Object.keys(config.rules));

// Rules that `npm run lint:lessons` reports but doesn't fail on yet. L-001 starts here because most open
// spec work still builds locators in specs, and L-010 because existing page objects and some open PRs still branch on page state;
// make each blocking once the code base and open PRs are ready.
export const REPORT_ONLY_RULES = new Set(['lessons/no-spec-locators', 'lessons/no-page-state-branch']);

export default lessons;
