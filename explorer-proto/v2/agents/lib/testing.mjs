// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable no-process-env -- Prettier owns formatting and the repo relaxes these rules for .ts/.js only; awaits in loops run in order by design */

// Helpers for the self-tests: run a node script, assert, make temp directories, produce a real pending task.
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {PILOT_CLI, REPO_ROOT} from './common.mjs';

export class CheckFailure extends Error {}

export function assert(condition, message) {
    if (!condition) {
        throw new CheckFailure(message);
    }
}

export function tempDir(prefix) {
    return fs.mkdtempSync(path.join(os.tmpdir(), `${prefix}-`));
}

export function runNode(args, {env = {}, input = '', cwd = REPO_ROOT, timeoutMs = 240000} = {}) {
    return new Promise((resolve) => {
        const child = spawn(process.execPath, args, {
            cwd,
            env: {...process.env, ...env},
            stdio: ['pipe', 'pipe', 'pipe'],
        });
        let stdout = '';
        let stderr = '';
        const timer = setTimeout(() => child.kill('SIGKILL'), timeoutMs);
        child.stdout.on('data', (d) => {
            stdout += d.toString('utf8');
        });
        child.stderr.on('data', (d) => {
            stderr += d.toString('utf8');
        });
        child.stdin.on('error', () => {});
        child.stdin.end(input);
        child.on('close', (code) => {
            clearTimeout(timer);
            resolve({code, stdout, stderr});
        });
    });
}

export function pilot(args, options) {
    return runNode([PILOT_CLI, ...args], options);
}

/** Runs the real orchestrator dry run with the manual provider; returns the out dir holding a pending task. */
export async function makePendingRun(prefix = 'pilot-agents') {
    const out = path.join(tempDir(prefix), 'out');
    const ran = await pilot([
        'run',
        '--target',
        'main',
        '--feature',
        'channels.favorites',
        '--dry-run',
        '--agents=manual',
        '--out',
        out,
    ]);
    assert(ran.code === 20, `the manual dry run should stop with exit 20, got ${ran.code}`);
    const taskFile = path.join(out, '4-select', 'agent-task.json');
    assert(fs.existsSync(taskFile), 'the dry run did not write 4-select/agent-task.json');
    return {out, taskFile, resultFile: path.join(out, '4-select', 'agent-result.json')};
}

export function removeDir(dir) {
    fs.rmSync(dir, {recursive: true, force: true});
}
