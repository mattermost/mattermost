// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import typescript from '@rollup/plugin-typescript';
import copy from 'rollup-plugin-copy';

export default {
    input: 'src/index.ts',
    output: [
        {
            dir: 'dist',
            format: 'esm',
            sourcemap: true,
            preserveModules: true, // Keep file structure
            preserveModulesRoot: 'src',
        },
    ],
    plugins: [
        typescript(),
        copy({
            targets: [
                {src: 'src/asset/**/*', dest: 'dist/asset'}, // Copy assets to dist/
                {src: 'src/containers/assets/**/*', dest: 'dist/containers/assets'},
            ],
        }),
    ],
    external: [
        '@playwright/test',
        '@mattermost/client',
        '@mattermost/types/config',
        '@axe-core/playwright',
        '@azure/storage-blob',
        '@percy/playwright',
        '@testcontainers/postgresql',
        'dotenv',
        'ldapts',
        'luxon',
        'minio',
        'node:child_process',
        'node:path',
        'node:fs',
        'node:fs/promises',
        'node:os',
        'node:crypto',
        'node:url',
        'node:util',
        'mime-types',
        'testcontainers',
        'uuid',
        'async-wait-until',
        'chalk',
        'deepmerge',
    ],
};
