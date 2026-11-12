// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import playwright from 'eslint-plugin-playwright';

// Lint rules for the "Lessons from master failures" in AGENTS.md. They are not part of `npm run lint`:
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

const XPATH = /^(xpath=|\/\/|\(\/\/)/;

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

// True when `node` is evaluated as a condition: an if, ternary, loop or logical operand.
const PASS_THROUGH = new Set(['LogicalExpression', 'UnaryExpression', 'AwaitExpression', 'TSNonNullExpression']);
const CONDITIONAL = new Set(['IfStatement', 'ConditionalExpression', 'WhileStatement', 'DoWhileStatement']);

function isInCondition(node) {
    let child = node;
    let parent = node.parent;
    while (parent && PASS_THROUGH.has(parent.type)) {
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
                if (methodName(node) !== 'locator') {
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

const lessons = {
    meta: {name: 'mattermost-e2e-lessons'},
    rules: {
        'no-spec-locators': noSpecLocators,
        'no-xpath': noXpath,
        'no-unwaited-is-visible': noUnwaitedIsVisible,
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

export default lessons;
