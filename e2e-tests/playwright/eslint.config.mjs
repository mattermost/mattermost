// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import globals from 'globals';

import eslintPlugin from '@mattermost/eslint-plugin';
import testSurface from '@mattermost/test-surface/lint';

export default [
    {
        ignores: [
            '**/node_modules',
            'test-surface/**',
            'lib/src/ui/generated/**',
            '**/dist',
            '**/playwright-report',
            '**/test-results',
            '**/results',
            '.mattermost_data/**',
            'lib/src/containers/assets/webhook/tests/**',
        ],
    },
    ...eslintPlugin.configs.base,
    {
        plugins: {
            'test-surface': testSurface,
        },
    },
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

    // Actions are recognized by the type of what they are called on, so specs and flows lint with types.
    {
        files: ['specs/**/*.ts', 'lib/src/flows/**/*.ts', 'lib/src/ui/flows/**/*.ts'],
        languageOptions: {
            parserOptions: {
                projectService: true,
                tsconfigRootDir: import.meta.dirname,
            },
        },
        rules: {
            'test-surface/e2e-observe-actions': 'error',
            'test-surface/e2e-no-floating-actions': 'error',
            'test-surface/e2e-disable-reason': 'error',
            'test-surface/e2e-no-locator-action': 'error',
        },
    },

    // Specs reach elements through the generated page objects, not literal selectors, and keep to patterns that say what
    // a test does: no branching on page state, no swallowed errors, no sleeps, no URL text. A line that must break one of
    // these says why, with a reason on the disable. Positional picks (`.first()`, `.last()`, `.nth()`) stay warnings until
    // the page objects can name every item they are used for.
    {
        files: ['specs/**/*.ts'],
        rules: {
            'test-surface/e2e-no-literal-locators': 'error',
            'test-surface/e2e-no-probes': 'error',
            'test-surface/e2e-no-conditional-logic': 'error',
            'test-surface/e2e-no-swallowed-catch': 'error',
            'test-surface/e2e-no-sleeps': 'error',
            'test-surface/e2e-no-soft-assertions': 'error',
            'test-surface/e2e-no-url-assertions': 'error',
            'test-surface/e2e-no-positional-picks': 'warn',
            '@typescript-eslint/await-thenable': 'error',
            '@typescript-eslint/no-non-null-assertion': 'error',
        },
    },

    // Plugin specs test UI that a plugin renders, not the webapp, so their elements cannot take the webapp's test ids
    // and the scanner does not cover them. They stay warnings.
    {
        files: ['specs/functional/plugins/**/*.ts', 'specs/functional/system_console/plugins/**/*.ts'],
        rules: {
            'test-surface/e2e-no-literal-locators': 'warn',
            'test-surface/e2e-no-probes': 'warn',
            'test-surface/e2e-no-conditional-logic': 'warn',
            'test-surface/e2e-no-swallowed-catch': 'warn',
            'test-surface/e2e-no-sleeps': 'warn',
            'test-surface/e2e-no-soft-assertions': 'warn',
            'test-surface/e2e-no-url-assertions': 'warn',
            '@typescript-eslint/await-thenable': 'warn',
            '@typescript-eslint/no-non-null-assertion': 'warn',
        },
    },

    // The lib's type tests declare values only to read their types, and write bindings the way generated code does:
    // `{}` for a part that does nothing at a mount.
    {
        files: ['lib/typecheck/**/*.ts', 'lib/test/fixture.ts'],
        rules: {
            '@typescript-eslint/no-empty-object-type': 'off',
            '@typescript-eslint/no-unused-vars': 'off',
        },
    },
];
