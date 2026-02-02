// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import typescript from '@rollup/plugin-typescript';
import copy from 'rollup-plugin-copy';

export default {
    input: 'src/index.ts',
    output: [
        {
            dir: 'dist',
            format: 'cjs', // CommonJS for Playwright
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
            ],
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
        // Also include unprefixed Node.js built-ins
        'fs',
        'path',
        'crypto',
        'mime-types',
        'uuid',
        'async-wait-until',
        'chalk',
        'deepmerge',
        'pdf-parse',
        'marked',
        'openai',
        '@anthropic-ai/sdk',
    ],
};
