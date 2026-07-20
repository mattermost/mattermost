// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import pluginCypress from 'eslint-plugin-cypress';
import noOnlyTest from 'eslint-plugin-no-only-tests';
import globals from 'globals';

import eslintPlugin from '@mattermost/eslint-plugin';

export default [
    {
        ignores: ['**/node_modules', '**/logs', '**/results'],
    },
    ...eslintPlugin.configs.base,
    {
        files: ['**/*.ts', '**/*.js'],
        plugins: {
            cypress: pluginCypress,
            'no-only-tests': noOnlyTest,
        },
        languageOptions: {
            globals: {
                ...globals.chai,
                ...globals.node,
                ...globals.mocha,
                Cypress: 'readonly',
                cy: 'readonly',
            },
        },
        settings: {
            'import/resolver': {
                node: true,
            },
        },
        rules: {
            'cypress/assertion-before-screenshot': 'warn',
            'cypress/no-assigning-return-values': 'error',
            'cypress/no-force': 'off',
            'cypress/no-async-tests': 'error',
            'cypress/no-pause': 'error',
            'cypress/no-unnecessary-waiting': 0,
            'cypress/unsafe-to-chain-command': 0,
            'func-names': 0,
            'global-require': 0,
            '@stylistic/lines-around-comment': 0,
            'max-nested-callbacks': 0,
            'no-await-in-loop': 0,
            'no-loop-func': 0,
            'no-unused-expressions': 0,
            'no-process-env': 0,
            'no-duplicate-imports': 0,
            'no-undefined': 0,
            'no-use-before-define': 0,
            'no-only-tests/no-only-tests': ['error', {focus: ['only']}],
            'no-console': 'error',
            '@typescript-eslint/explicit-module-boundary-types': 'off',
            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/no-require-imports': 'off',
            '@typescript-eslint/no-unused-expressions': 'off',
            '@typescript-eslint/no-var-requires': 'off',
            'headers/header-format': [
                'error',
                {
                    source: 'string',
                    style: 'line',
                    content: 'Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.\nSee LICENSE.txt for license information.',
                    trailingNewlines: 2,
                },
            ],
            'import/no-duplicates': 2,
            'import/order': [
                'error',
                {
                    'newlines-between': 'always',
                    groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
                },
            ],
            'import/no-unresolved': 'off',
            'max-lines': ['warn', {max: 800, skipBlankLines: true, skipComments: true}],
            '@stylistic/eol-last': ['error', 'always'],
            '@stylistic/no-trailing-spaces': 'error',
        },
    },
];
