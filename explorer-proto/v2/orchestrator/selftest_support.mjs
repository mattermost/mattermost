// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable no-process-env -- the selftest builds the environment of the coordinator under test */

// Shared helpers of the offline checks: a fake infra directory (selftest_fake_infra.mjs stands in for Docker, the seed
// and the engine's replay), the pilot invoker and the common arguments of a verify-spec run.
import {spawn, spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import {ORCH_DIR, REPO_ROOT} from './lib/common.mjs';

export const PILOT = path.join(ORCH_DIR, 'pilot.mjs');
export const FAKE = path.join(ORCH_DIR, 'selftest_fake_infra.mjs');
export const SPEC = 'explorer-proto/sessions/bookmarks/generated/channels_bookmarks_bar_follows_switch.spec.ts';
export const CONTROL = 'release-bookmark-title-changed';
export const LICENCE_PLACEHOLDER = 'synthetic-selftest-placeholder-value';
export const PASS_ENV = 'FAKE_RUN,FAKE_OMIT_SESSION,FAKE_VERIFIER_SLEEP';

export function createSupport({newDir}) {
    function fakeInfra(extraEnv = {}) {
        const dir = newDir('fake-infra');
        const run = path.join(dir, '.run');
        const scripts = path.join(dir, 'scripts');
        fs.mkdirSync(run, {recursive: true});
        fs.mkdirSync(scripts, {recursive: true});
        const call = (cmd) => `#!/usr/bin/env bash\nexec node "${FAKE}" ${cmd} "$@"\n`;
        for (const cmd of ['gate', 'up', 'down']) {
            fs.writeFileSync(path.join(scripts, `${cmd}.sh`), call(cmd), {mode: 0o755});
        }
        const nodeWrapper = (cmd) =>
            `import {spawnSync} from 'node:child_process';\nconst r = spawnSync(process.execPath, ['${FAKE}', '${cmd}', ...process.argv.slice(2)], {stdio: 'inherit'});\nprocess.exit(r.status ?? 1);\n`;
        fs.writeFileSync(path.join(scripts, 'bookmark_ctl.mjs'), nodeWrapper('ctl'));
        fs.writeFileSync(path.join(scripts, 'verify_seed.mjs'), nodeWrapper('verify_seed'));
        const env = {
            ...process.env,
            MM_LICENSE: LICENCE_PLACEHOLDER,
            PILOT_INFRA_DIR: dir,
            FAKE_RUN: run,
            PILOT_REPLAY_CMD: `node ${FAKE} replay`,
            PILOT_REPLAY_REPORT: path.join(dir, 'replay-report.json'),
            PILOT_VERIFIER_PASS_ENV: PASS_ENV,
            ...extraEnv,
        };
        delete env.MATTERMOST_PILOT_IMAGE;
        Object.assign(env, extraEnv);
        const read = (name) => {
            const file = path.join(run, name);
            return fs.existsSync(file) ? fs.readFileSync(file, 'utf8').trim().split('\n') : [];
        };
        return {dir, run, env, calls: () => read('calls.log'), args: () => read('args.log')};
    }

    const spawnOptions = (env) => ({cwd: REPO_ROOT, encoding: 'utf8', env, maxBuffer: 64 * 1024 * 1024});

    function pilot(args, env) {
        const r = spawnSync('node', [PILOT, ...args], spawnOptions(env));
        return {status: r.status, signal: r.signal, stdout: r.stdout, stderr: r.stderr};
    }

    function pilotAsync(args, env) {
        const child = spawn('node', [PILOT, ...args], {cwd: REPO_ROOT, env, stdio: ['ignore', 'pipe', 'pipe']});
        let stdout = '';
        child.stdout.on('data', (d) => {
            stdout += d;
        });
        child.stderr.on('data', () => {});
        const done = new Promise((resolve) => child.on('close', (status, signal) => resolve({status, signal, stdout})));
        return {child, done};
    }

    function verifyArgs(out, id, extra = []) {
        return [
            'run',
            '--target',
            'release',
            '--live',
            '--agents=manual',
            '--verify-spec',
            SPEC,
            '--engine-charter',
            'session:bookmarks',
            '--control',
            CONTROL,
            '--run-id',
            id,
            '--out',
            out,
            ...extra,
        ];
    }

    return {fakeInfra, pilot, pilotAsync, verifyArgs};
}
