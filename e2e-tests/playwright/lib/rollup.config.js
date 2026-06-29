// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {fileURLToPath} from 'node:url';
import path from 'node:path';

import alias from '@rollup/plugin-alias';
import typescript from '@rollup/plugin-typescript';
import copy from 'rollup-plugin-copy';

const dirname = path.dirname(fileURLToPath(import.meta.url));

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
        alias({
            entries: [{find: '@', replacement: path.resolve(dirname, 'src')}],
        }),
        typescript(),
        copy({
            targets: [{src: 'src/asset/**/*', dest: 'dist/asset'}], // Copy assets to dist/
        }),
    ],
    external: [
        '@playwright/test',
        '@mattermost/client',
        '@mattermost/types/config',
        '@axe-core/playwright',
        '@percy/playwright',
        'dotenv',
        'luxon',
        'node:fs/promises',
        'node:path',
        'node:fs',
        'node:os',
        'mime-types',
        'uuid',
        'async-wait-until',
        'chalk',
        'deepmerge',
    ],
};
