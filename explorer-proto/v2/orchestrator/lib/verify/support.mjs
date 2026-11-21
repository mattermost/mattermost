// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable no-process-env -- the licence scanner reads MM_LICENSE from its own environment and prints PASS or FAIL only */

// Helpers shared by the stages that verify an existing spec.
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import {unsafeFindings} from './trace.mjs';

import {INFRA_DIR, REPO_ROOT} from '../common.mjs';
import {engineFor} from '../engine.mjs';

/** The engine session of this run (`--engine-charter session:<name>`). */
export function engineOf(flags) {
    const engine = engineFor(flags, {});
    if (!engine.supported || engine.kind !== 'session') {
        throw new Error(`the engine cannot replay ${flags.engineCharter}: ${engine.reason ?? 'not a session'}`);
    }
    return engine;
}

/** The setup record of the newest passing stage-0 attempt: session, fixture fingerprint, image digest. */
export function currentSetup(ctx) {
    const status = ctx.readJson(0, 'status.json', 'orch#stage0-status');
    if (status.current_attempt === null) {
        throw new Error('stage 0 has no passing attempt');
    }
    return ctx.readJson(0, `attempt-${status.current_attempt}/setup.json`, 'orch#stage0-setup');
}

/** Scans the files for unsafe text and, when MM_LICENSE is exported, for the licence (in memory, PASS or FAIL). */
export function leakScan(files, options = {}) {
    let unsafe = 'PASS';
    for (const file of files) {
        if (unsafeFindings(fs.readFileSync(file, 'utf8'), options).length > 0) {
            unsafe = 'FAIL';
        }
    }
    let licence = 'not_run';
    if (process.env.MM_LICENSE) {
        const done = spawnSync('node', [path.join(INFRA_DIR, 'scripts', 'leak_scan.mjs'), ...files], {
            cwd: REPO_ROOT,
            encoding: 'utf8',
        });
        licence = /^PASS/.test(done.stdout ?? '') ? 'PASS' : 'FAIL';
    }
    return {unsafe_text: unsafe, licence};
}
