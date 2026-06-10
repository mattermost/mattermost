// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import globals from 'globals';

import eslintPlugin from '@mattermost/eslint-plugin';

export default [
    {
        ignores: ['**/node_modules', '**/dist', '**/playwright-report', '**/test-results', '**/results'],
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
            '@typescript-eslint/explicit-module-boundary-types': 'off',
            '@typescript-eslint/indent': 'off', // Covered by Prettier
            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/no-var-requires': 'off',
            'func-names': 'off',
            'dot-location': 'off', // Covered by Prettier
            'lines-around-comment': 'off', // Covered by Prettier
            'max-lines': ['warn', {max: 800, skipBlankLines: true, skipComments: true}],
            'multiline-ternary': 'off', // Covered by Prettier
            'no-await-in-loop': 'off',
            'no-console': 'error',
            'no-loop-func': 0,
            'no-mixed-operators': 'off',
            'no-process-env': 0,
            'no-process-exit': 0,
            'operator-linebreak': 'off', // Covered by Prettier
            'space-before-function-paren': 'off', // Covered by Prettier
            'wrap-regex': 'off', // Covered by Prettier
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
        },
    },
];
