// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import globals from 'globals';

import eslintPlugin from '@mattermost/eslint-plugin';

export default [
    {
        ignores: [
            '**/node_modules',
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
            '@mattermost/playwright-ensure-feature-flag-top-level': 'error',
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

    // Pre-existing ensureFeatureFlag usage that predates the
    // @mattermost/playwright-ensure-feature-flag-top-level rule above and does not yet
    // comply with it (multiple calls per file, and/or calls outside a top-level beforeAll).
    // Each needs its own split-into-single-beforeAll pass, out of scope for the change
    // that introduced the rule. Remove an entry here once its file is brought into
    // compliance.
    {
        files: [
            'specs/functional/channels/burn_on_read/restrictions.spec.ts',
            'specs/functional/channels/scheduled_messages/scheduled_messages.spec.ts',
            'specs/functional/channels/wysiwyg_editor/autocomplete.spec.ts',
            'specs/functional/channels/wysiwyg_editor/composing.spec.ts',
            'specs/functional/channels/wysiwyg_editor/formatting_bar.spec.ts',
            'specs/functional/channels/wysiwyg_editor/gating.spec.ts',
            'specs/functional/channels/wysiwyg_editor/markdown.spec.ts',
            'specs/functional/channels/wysiwyg_editor/paste.spec.ts',
            'specs/functional/channels/wysiwyg_editor/rhs.spec.ts',
            'specs/functional/system_console/abac/resource_attributes/authoring.spec.ts',
            'specs/functional/system_console/abac/resource_attributes/membership_sync.spec.ts',
            'specs/functional/system_console/abac/resource_attributes/multiselect_sync.spec.ts',
            'specs/functional/system_console/abac/resource_attributes/test_picker.spec.ts',
            'specs/functional/system_console/feature_flag.spec.ts',
        ],
        rules: {
            '@mattermost/playwright-ensure-feature-flag-top-level': 'off',
        },
    },
];
