// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import eslintPlugin from '@mattermost/eslint-plugin';

export default [
    ...eslintPlugin.configs.base,

    // typescript-eslint v8 upgrade baseline: existing violations disabled
    // per-rule x per-file so they can be fixed incrementally. Do not add new files here.
    {
        files: [
            'src/boards.ts',
        ],
        rules: {
            '@typescript-eslint/no-unused-vars': 'off',
        },
    },
];
