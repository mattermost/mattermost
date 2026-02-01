// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import typescript from '@rollup/plugin-typescript';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';

export default {
    input: ['src/index.ts', 'src/cli.ts'],
    output: [
        {
            dir: 'dist',
            format: 'cjs',
            sourcemap: true,
            preserveModules: false, // Bundle chalk into output
        },
    ],
    plugins: [
        resolve({
            // Prefer Node.js exports over browser (fixes chalk/supports-color)
            exportConditions: ['node', 'import', 'require', 'default'],
            preferBuiltins: true,
        }),
        commonjs(), // Convert CJS modules
        typescript(),
    ],
    external: [
        'testcontainers',
        '@testcontainers/postgresql',
        'commander',
        // chalk is bundled (ESM-only in v5.x)
        'dotenv',
        'jsonc-parser',
        'fs',
        'path',
        'child_process',
        'http',
        'node:fs',
        'node:fs/promises',
        'node:path',
        'node:os',
        'node:child_process',
    ],
};
