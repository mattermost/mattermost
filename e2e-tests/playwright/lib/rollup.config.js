// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import typescript from '@rollup/plugin-typescript';
import copy from 'rollup-plugin-copy';

export default {
    input: 'src/index.ts',
    output: [
        {dir: 'dist', format: 'cjs', sourcemap: true}, // CommonJS for Playwright
    ],
    plugins: [
        typescript(),
        copy({
            targets: [{src: 'src/asset/**/*', dest: 'dist/asset'}], // Copy assets to dist/
        }),
    ],
    external: ['playwright'], // Prevent bundling Playwright
};
