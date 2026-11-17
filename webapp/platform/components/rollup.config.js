// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';
import {transform} from '@swc/core';
import scss from 'rollup-plugin-scss';

import packagejson from './package.json';

const externals = [
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

// Type checking and declarations come from tsc (see the build script), so this only strips types.
function swc() {
    return {
        name: 'swc',
        transform(code, id) {
            if (!(/\.tsx?$/).test(id)) {
                return null;
            }

            return transform(code, {
                filename: id,
                sourceMaps: true,
                jsc: {
                    parser: {syntax: 'typescript', tsx: id.endsWith('.tsx')},
                    target: 'esnext',
                    transform: {
                        react: {runtime: 'classic'},
                        useDefineForClassFields: true,
                    },
                },
            });
        },
    };
}

function isExternal(id) {
    if (externals.includes(id)) {
        return true;
    }

    // Peer packages are often imported via subpaths (e.g. @mattermost/compass-ui/components/button).
    return externals.some((external) => id === external || id.startsWith(`${external}/`));
}

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
            swc(),
        ],
        external: isExternal,
        watch: {
            clearScreen: false,
        },
    },
];
