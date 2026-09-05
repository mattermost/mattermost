// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import typescript from '@rollup/plugin-typescript';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';

export default {
    input: ['src/index.ts', 'src/cli.ts'],
    output: [
        {
            dir: 'dist',
            format: 'cjs',
            sourcemap: true,
            chunkFileNames: '[name].js',
        },
    ],
    plugins: [
        resolve({
            // Prefer Node.js exports over browser (fixes chalk/supports-color)
            exportConditions: ['node', 'import', 'require', 'default'],
            preferBuiltins: true,
        }),
        commonjs(), // Convert CJS modules
        json(), // Handle JSON imports
        typescript({
            exclude: ['src/**/*.test.ts', 'src/integration/**'],
        }),
    ],
    // testcontainers has native modules (ssh2) that cannot be bundled
    // Other dependencies (commander, dotenv, chalk, jsonc-parser, zod) are bundled
    external: [
        // Packages with native modules - must be installed via npm
        'testcontainers',
        '@testcontainers/postgresql',
        // Node.js built-in modules
        'fs',
        'path',
        'child_process',
        'http',
        'https',
        'url',
        'util',
        'os',
        'stream',
        'events',
        'buffer',
        'crypto',
        'net',
        'tls',
        'dns',
        'zlib',
        'assert',
        'querystring',
        'string_decoder',
        'timers',
        'tty',
        // Node.js built-in modules with node: prefix
        'node:fs',
        'node:fs/promises',
        'node:path',
        'node:os',
        'node:child_process',
        'node:process',
        'node:tty',
        'node:stream',
        'node:events',
        'node:util',
        'node:crypto',
        'node:net',
        'node:http',
        'node:https',
        'node:url',
        'node:zlib',
        'node:buffer',
        'node:assert',
        'node:timers',
        'node:dns',
        'node:tls',
        'node:querystring',
        'node:string_decoder',
    ],
};
