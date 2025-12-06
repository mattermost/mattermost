// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';
import sassModern from './rollup-plugin-sass-modern.mjs';

import packagejson from './package.json';

const externalPackages = [
    ...Object.keys(packagejson.dependencies || {}),
    ...Object.keys(packagejson.peerDependencies || {}),
    'lodash',
    'react',
    'mattermost-redux',
    'reselect',
];

// Function to check if an import should be external (handles subpath imports)
const isExternal = (id) => {
    return externalPackages.some((pkg) => id === pkg || id.startsWith(`${pkg}/`));
};

export default [
    {
        input: 'src/index.tsx',
        output: [
            {
                sourcemap: true,
                file: packagejson.module,
                format: 'es',
                globals: {'styled-components': 'styled'},
            },
        ],
        plugins: [
            sassModern({
                fileName: 'index.esm.css',
                sourceMap: true,
            }),
            resolve({
                browser: true,
                extensions: ['.ts', '.tsx'],
            }),
            commonjs(),
            typescript({
                outputToFilesystem: true,
            }),
        ],
        external: isExternal,
        watch: {
            clearScreen: false,
        },
    },
];
