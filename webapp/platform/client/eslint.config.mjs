// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import formatjsPlugin from 'eslint-plugin-formatjs';
import noOnlyTestsPlugin from 'eslint-plugin-no-only-tests';

import eslintPlugin from '@mattermost/eslint-plugin';

export default [
    ...eslintPlugin.configs.base,
    {
        files: ['**/*.js', '**/*.mjs', '**/*.ts'],
        rules: {
            'no-restricted-globals': [
                'error',
                'window'
            ]
        }
    },
    {
        files: ['**/*.test.js', '**/*.test.ts'],
        rules: {
            'no-restricted-globals': 'off'
        }
    }
];
