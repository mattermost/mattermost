// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {build} from 'esbuild';

const OutputFolder = 'dist';
const OutFile = `${OutputFolder}/index.mjs`;

async function generateBundle() {
    await build({
        entryPoints: ['src/index.ts'],
        bundle: true,
        platform: 'node',
        
        // We need to bundle the package as ESM modules so that it can be used by the mattermost-load-test-ng/browser framework
        // which itself is written in ESM.
        format: 'esm',
        outfile: OutFile,
        external: [
            // All of the below dependencies are provided by the mattermost-load-test-ng/browser framework
            // and are not needed to be bundled with the plugin's loadtest-browser package
            '@mattermost/loadtest-browser-lib',
            '@mattermost/playwright-lib',
            '@playwright/test',
        ],
    });
}


await generateBundle();
