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
        files: ['**/*.ts', '**/*.js', '**/*.mjs'],
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
        },
    },
    {
        // Build scripts may use console I/O, process.exit, and Node-style __dirname polyfill.
        files: ['lib/scripts/**/*.mjs'],
        rules: {
            'no-console': 'off',
            'no-process-exit': 'off',
            'no-underscore-dangle': 'off',
            '@typescript-eslint/naming-convention': 'off',
        },
    },
    {
        // Auto-generated i18n file: relax quote-props and max-lines.
        files: ['lib/src/i18n.ts'],
        rules: {
            '@stylistic/quote-props': 'off',
            'max-lines': 'off',
        },
    },
    {
        // POM files must use semantic locators only — no CSS class selectors or hardcoded strings.
        files: ['lib/src/ui/**/*.ts'],
        rules: {
            'no-restricted-syntax': [
                'error',
                {
                    selector: "CallExpression[callee.property.name='locator'][arguments.0.value=/^\\./]",
                    message:
                        'CSS class selectors are forbidden in POM locators. Use getByTestId(), getByRole(), getByLabel(), or getByPlaceholder() instead.',
                },
                {
                    selector: "CallExpression[callee.property.name='getByText'][arguments.0.type='Literal']",
                    message:
                        "Hardcoded strings in getByText() are forbidden. Import en from '@/i18n' and use en['translation.key'].",
                },
                {
                    selector:
                        "CallExpression[callee.property.name='getByRole'] Property[key.name='name'][value.type='Literal']",
                    message:
                        "Hardcoded name option in getByRole() is forbidden. Import en from '@/i18n' and use en['translation.key'].",
                },
            ],
        },
    },
];
