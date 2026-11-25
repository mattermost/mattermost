// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import globals from 'globals';

import eslintPlugin from '@mattermost/eslint-plugin';

import uiSurfacePlugin from './ui-surface/lint/index.mjs';

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
        rules: {
            'ui-surface/no-sleeps': 'warn',
            'ui-surface/no-probes': 'warn',
            'ui-surface/no-swallowed-catch': 'warn',
            'ui-surface/no-positional-picks': 'warn',
            'ui-surface/no-raw-css-locators': 'warn',
            'ui-surface/observe-actions': 'warn',
            'ui-surface/no-literal-absence': 'warn',
            'ui-surface/no-floating-actions': 'warn',
            'ui-surface/no-soft-assertions': 'warn',
            'ui-surface/no-conditional-logic': 'warn',
            'ui-surface/no-locator-action': 'warn',
            'ui-surface/disable-reason': 'warn',
        },
    },
    {
        files: [
            'specs/functional/auth/password_length.spec.ts',
            'specs/functional/channels/channel_attributes/channel_attribute_editing.spec.ts',
            'specs/functional/channels/channel_settings/channel_headers.spec.ts',
            'specs/functional/channels/channel_settings/default_channel_url.spec.ts',
            'specs/functional/channels/channel_settings/join_leave_messages.spec.ts',
            'specs/functional/channels/channel_settings/modal_behavior.spec.ts',
            'specs/functional/channels/channel_settings/unsaved_changes_on_open.spec.ts',
            'specs/functional/channels/drafts/draft_send_from_panel.spec.ts',
            'specs/functional/channels/messaging/edit_history_restore.spec.ts',
            'specs/functional/channels/messaging/message_reply_too_long.spec.ts',
            'specs/functional/channels/plugin_marketplace/install_configure_remove_plugin.spec.ts',
            'specs/functional/channels/team_settings/team_settings_info.spec.ts',
            'specs/functional/channels/team_settings/team_settings_unsaved_changes.spec.ts',
            'specs/functional/channels/threads/threads_list.spec.ts',
            'specs/functional/system_console/concurrent_config_save.spec.ts',
            'specs/functional/system_console/plugins/restrict_unauthenticated_webapp_plugins.spec.ts',
        ],
        plugins: {
            'ui-surface': uiSurfacePlugin,
        },
        rules: {
            'ui-surface/no-sleeps': 'error',
            'ui-surface/no-probes': 'error',
            'ui-surface/no-swallowed-catch': 'error',
            'ui-surface/no-positional-picks': 'error',
            'ui-surface/no-raw-css-locators': 'error',
            'ui-surface/observe-actions': 'error',
            'ui-surface/no-literal-absence': 'error',
            'ui-surface/no-floating-actions': 'error',
            'ui-surface/no-soft-assertions': 'error',
            'ui-surface/no-conditional-logic': 'error',
            'ui-surface/no-locator-action': 'error',
            'ui-surface/disable-reason': 'error',
        },
    },
];
