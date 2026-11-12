// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import eslintPlugin from '@mattermost/eslint-plugin';

export default [
    ...eslintPlugin.configs.base,
    {
        files: ['**/*.test.js', '**/*.test.jsx', '**/*.test.ts', '**/*.test.tsx'],
        rules: {
            'no-restricted-properties': ['error', ...['toMatchSnapshot', 'toMatchInlineSnapshot', 'toThrowErrorMatchingSnapshot', 'toThrowErrorMatchingInlineSnapshot'].map((property) => ({
                property,
                message: "Don't use snapshot tests. Assert explicitly on what should be rendered instead.",
            }))],
        },
    },
];
