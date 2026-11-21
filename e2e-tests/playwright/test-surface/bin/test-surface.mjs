#!/usr/bin/env node
// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Runs from source: Node 24 strips TypeScript types natively, so the tool has no build step.

import {spawnSync} from 'node:child_process';
import {existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

// a whole-webapp program needs more than Node's default heap: rerun with 4 GB unless the caller chose a size (a
// whole-webapp scan and generate peak at about 2.5 GB of heap; watch mode, which keeps the program, at about 3 GB)
const sized = (args) => args.some((a) => a.startsWith('--max-old-space-size'));
// eslint-disable-next-line no-process-env -- a size set through NODE_OPTIONS wins too
if (!sized(process.execArgv) && !sized((process.env.NODE_OPTIONS ?? '').split(/\s+/))) {
    const res = spawnSync(process.execPath, ['--max-old-space-size=4096', ...process.execArgv, fileURLToPath(import.meta.url), ...process.argv.slice(2)], {stdio: 'inherit'});
    process.exitCode = res.status ?? 1;
} else {
    const entry = existsSync(new URL('../src/cli.ts', import.meta.url)) ? '../src/cli.ts' : '../dist/cli.js';
    const {main} = await import(entry);
    main(process.argv.slice(2)).then((code) => {
        process.exitCode = code;
    }, (err) => {
        // eslint-disable-next-line no-console
        console.error(err);
        process.exitCode = 2;
    });
}
