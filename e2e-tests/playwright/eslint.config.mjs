// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {readFileSync} from 'node:fs';

import globals from 'globals';

import eslintPlugin from '@mattermost/eslint-plugin';

import uiSurfacePlugin from './ui-surface/lint/index.mjs';

// Every ui-surface spec rule. Warn across all specs; error on the growable strict list (ui-surface/strict-specs.json).
const UI_SURFACE_SPEC_RULES = [
    'no-sleeps',
    'no-probes',
    'no-swallowed-catch',
    'no-positional-picks',
    'no-raw-css-locators',
    'observe-actions',
    'no-literal-absence',
    'no-floating-actions',
    'no-soft-assertions',
    'no-conditional-logic',
    'no-url-assertions',
    'no-locator-action',
    'disable-reason',
];
const specRules = (level) => Object.fromEntries(UI_SURFACE_SPEC_RULES.map((r) => [`ui-surface/${r}`, level]));
const strictSpecs = JSON.parse(readFileSync(new URL('./ui-surface/strict-specs.json', import.meta.url))).strict;

export default [
    {
        ignores: [
            '**/node_modules',
            '**/dist',
            '**/surface/generated',
            '**/playwright-report',
            '**/test-results',
            '**/results',
            '.mattermost_data/**',
            'lib/src/containers/assets/webhook/tests/**',
        ],
    },
    ...eslintPlugin.configs.base,
    {
        files: ['**/*.ts', '**/*.js'],
        languageOptions: {
            globals: {
                ...globals.node,
            },
            ecmaVersion: 5,
            sourceType: 'module',
        },
        settings: {
            'import/resolver': {
                typescript: true,
                node: true,
            },
        },
        rules: {
            '@stylistic/dot-location': 'off', // Covered by Prettier
            '@stylistic/indent': 'off', // Covered by Prettier
            '@stylistic/lines-around-comment': 'off', // Covered by Prettier
            '@stylistic/multiline-ternary': 'off', // Covered by Prettier
            '@stylistic/no-mixed-operators': 'off',
            '@stylistic/operator-linebreak': 'off', // Covered by Prettier
            '@stylistic/space-before-function-paren': 'off', // Covered by Prettier
            '@stylistic/wrap-regex': 'off', // Covered by Prettier
            '@typescript-eslint/explicit-module-boundary-types': 'off',
            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/no-require-imports': 'off',
            'func-names': 'off',
            'max-lines': ['warn', {max: 800, skipBlankLines: true, skipComments: true}],
            'no-await-in-loop': 'off',
            'no-console': 'error',
            'no-empty-pattern': ['error', {allowObjectPatternsAsParameters: true}],
            'no-loop-func': 0,
            'no-process-env': 0,
            'no-process-exit': 0,
            'headers/header-format': [
                'error',
                {
                    source: 'string',
                    style: 'line',
                    content:
                        'Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.\nSee LICENSE.txt for license information.',
                    trailingNewlines: 2,
                },
            ],
            'import/order': [
                'error',
                {
                    'newlines-between': 'always',
                    groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
                },
            ],
            'import/no-unresolved': 'off',

            // Playwright resolves toHaveURL('/path') against baseURL, which drops the subpath in subpath mode.
            'no-restricted-syntax': [
                'error',
                {
                    selector:
                        "CallExpression[callee.property.name='toHaveURL'] > :matches(Literal[value=/^\\//], TemplateLiteral:first-child[quasis.0.value.raw=/^\\//])",
                    message: "toHaveURL('/path') drops the server subpath. Use toHavePath('/path') instead.",
                },
            ],
        },
    },
    {
        files: ['specs/**/*.ts', 'upgrade-specs/**/*.ts'],
        plugins: {
            'ui-surface': uiSurfacePlugin,
        },
        rules: specRules('warn'),
    },
    {
        files: strictSpecs,
        plugins: {
            'ui-surface': uiSurfacePlugin,
        },
        rules: specRules('error'),
    },
];
