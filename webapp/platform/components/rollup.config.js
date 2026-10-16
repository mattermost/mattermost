// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';
import scss from 'rollup-plugin-scss';

import packagejson from './package.json';

const externalPackages = [
    ...Object.keys(packagejson.dependencies || {}),
    ...Object.keys(packagejson.peerDependencies || {}),
    'lodash/throttle',
    'react',

    // react-dom is only a devDependency here, so without this it gets bundled into dist and the
    // web app ends up running two copies of the renderer.
    'react-dom',
    'mattermost-redux',
    'reselect',
];

// Rollup string externals only match exact ids (or ids under a pattern ending in `/`).
// Peer imports use subpaths (e.g. `@mattermost/compass-ui/components/icon`), so match those too.
const isExternal = (id) => externalPackages.some((name) => id === name || id.startsWith(`${name}/`));

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
            scss({
                fileName: 'index.esm.css',
                outputToFilesystem: true,
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
