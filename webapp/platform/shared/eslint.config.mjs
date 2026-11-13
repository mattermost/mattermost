// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import formatjsPlugin from 'eslint-plugin-formatjs';
import noOnlyTestsPlugin from 'eslint-plugin-no-only-tests';

import eslintPlugin from '@mattermost/eslint-plugin';

export default [
    ...eslintPlugin.configs.react,
    {
        files: ['**/*.js', '**/*.jsx', '**/*.ts', '**/*.tsx'],
        plugins: {
            formatjs: formatjsPlugin,
        },
    },
    {
        files: ['**/*.{test,spec}.{js,jsx,ts,tsx}'],
        plugins: {
            'no-only-tests': noOnlyTestsPlugin,
        },
        rules: {
            'no-only-tests/no-only-tests': ['error', {focus: ['only', 'skip']}],
            'no-restricted-properties': ['error', ...['toMatchSnapshot', 'toMatchInlineSnapshot', 'toThrowErrorMatchingSnapshot', 'toThrowErrorMatchingInlineSnapshot'].map((property) => ({
                property,
                message: "Don't use snapshot tests. Assert explicitly on what should be rendered instead.",
            }))],
        },
    },
];
