// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {defineConfig, globalIgnores} from 'eslint/config';
import formatjsPlugin from 'eslint-plugin-formatjs';
import noOnlyTestsPlugin from 'eslint-plugin-no-only-tests';

import eslintPlugin from '@mattermost/eslint-plugin';

export default defineConfig([
    ...eslintPlugin.configs.react,
    globalIgnores(['./dist']),
    {
        plugins: {
            formatjs: formatjsPlugin,
        },
        rules: {
            'react/prop-types': [
                2,
                {
                    ignore: [
                        'location',
                        'history',
                        'component',
                    ],
                },
            ],
            'react/no-unknown-property': [
                2,
                {
                    ignore: [
                        'mask-type',
                    ],
                },
            ],
            'react/style-prop-object': [2, {
                allow: ['Timestamp'],
            }],
            'formatjs/enforce-default-message': 2,
            'formatjs/enforce-id': 2,
            'formatjs/enforce-placeholders': 2,
            'formatjs/no-invalid-icu': 2,
            'formatjs/no-multiple-plurals': 1,
            'formatjs/no-multiple-whitespaces': 2,
            'formatjs/no-literal-string-in-jsx': 1,
            'formatjs/prefer-formatted-message': 1,
            'formatjs/no-useless-message': 1,
            'formatjs/prefer-pound-in-plural': 0,
            'react/jsx-fragments': ['error', 'syntax'],
        },
    },
    {
        files: ['**/*.test.js', '**/*.test.jsx', '**/*.test.ts', '**/*.test.tsx'],
        plugins: {
            'no-only-tests': noOnlyTestsPlugin,
        },
        rules: {
            'no-only-tests/no-only-tests': ['error', {focus: ['only', 'skip']}],
        },
    },
    {
        ignores: ['src/packages/mattermost-redux/**'],
        rules: {
            '@typescript-eslint/no-restricted-imports': [
                'error',
                {
                    paths: [{
                        name: 'mattermost-redux/types/actions',
                        importNames: ['DispatchFunc', 'GetStateFunc', 'ActionFunc', 'ActionFuncAsync', 'ThunkActionFunc'],
                        message: 'Use the web app version of it from types/store',
                    }],
                    patterns: [{
                        group: ['@mattermost/client/src/*', '@mattermost/components/src/*', '@mattermost/types/src/*'],
                        message: "Don't include the src folder when importing from packages in webapp/platform",
                    }],
                },
            ],
        },
    },
    {
        settings: {
            'import/resolver': 'webpack',
            formatjs: {
                additionalFunctionNames: ['localizeMessage', 'defineMessage'],
            },
        },
    },
]);
