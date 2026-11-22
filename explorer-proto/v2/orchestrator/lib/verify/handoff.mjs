// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable no-process-env -- the verifier process gets an allowlisted copy of the environment */

// The coordinator's side of the byte-exact handoff to the deterministic verifier process: freeze the two input files,
// bind them to one dispatch with a nonce, start the verifier as a separate OS process with a scrubbed environment and
// only artifact paths on its command line, and wait for it within a time budget.
import {spawn} from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {ORCH_REPO_PATH, REPO_ROOT, toPosix, writeCanonical} from '../common.mjs';

export const DELIVERY_MODE = 'process: same worker, artifact paths';
export const VERIFIER_KIND = 'deterministic-process';
export const VERIFIER_SCRIPT = `${ORCH_REPO_PATH}/verifier/bookmarks_verifier.mjs`;
export const DEFAULT_TIMEOUT_SECONDS = 1500;

const ENV_ALLOWLIST = [
    'PATH',
    'HOME',
    'LANG',
    'LC_ALL',
    'TMPDIR',
    'MM_LICENSE',
    'MATTERMOST_PILOT_IMAGE',
    'PILOT_PORT',
    'PW_ADMIN_USERNAME',
    'PW_ADMIN_PASSWORD',
    'PW_ADMIN_EMAIL',
    'DOCKER_HOST',
    'DOCKER_CONFIG',
    'DOCKER_CONTEXT',
    'XDG_RUNTIME_DIR',
    'PLAYWRIGHT_BROWSERS_PATH',
    'PILOT_INFRA_DIR',
    'PILOT_REPLAY_CMD',
    'PILOT_REPLAY_REPORT',
];

export const ENV_POLICY =
    'allowlist only (PATH, HOME, locale, Docker and Playwright locations, the infra image and port variables, MM_LICENSE for the stack start); no orchestrator state; PILOT_VERIFIER_PASS_ENV names extra test-seam variables';

export const newNonce = () => crypto.randomBytes(16).toString('hex');

export const sha256Bytes = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');

/** Makes the file read-only for everyone (chmod a-w). */
export function freezeReadOnly(file) {
    fs.chmodSync(file, 0o444);
}

export const isFrozen = (file) => (fs.statSync(file).mode & 0o222) === 0;

/** Gives the owner write access back so a run directory can be rewritten or deleted by ordinary tools. */
export function thaw(file) {
    if (fs.existsSync(file)) {
        fs.chmodSync(file, 0o644);
    }
}

/** Thaws every file below dir (a run directory that holds frozen inputs). */
export function thawTree(dir) {
    if (!fs.existsSync(dir)) {
        return;
    }
    for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
        const abs = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            thawTree(abs);
        } else if (entry.isFile()) {
            thaw(abs);
        }
    }
}

/** The environment the verifier gets: allowlisted names only. Returns {env, names}. */
export function scrubbedEnv(source = process.env) {
    const extra = String(source.PILOT_VERIFIER_PASS_ENV ?? '')
        .split(',')
        .map((n) => n.trim())
        .filter((n) => /^[A-Z][A-Z0-9_]*$/.test(n));
    const env = {};
    for (const name of [...ENV_ALLOWLIST, ...extra]) {
        if (source[name] !== undefined) {
            env[name] = source[name];
        }
    }
    return {env, names: Object.keys(env).sort()};
}

/** The verifier's command line: script and artifact paths only, never an artifact's contents. */
export function verifierArgv({task, trace, out, nonceFile}) {
    return [
        'node',
        path.join(REPO_ROOT, VERIFIER_SCRIPT),
        '--task',
        task,
        '--trace',
        trace,
        '--out',
        out,
        '--nonce-file',
        nonceFile,
    ];
}

/** The same command with machine-specific path prefixes replaced, for records that leave the worker. */
export function portableArgv(argv, {run, scratch}) {
    const swap = (token) => {
        for (const [prefix, label] of [
            [run, '<run>'],
            [scratch, '<scratch>'],
            [REPO_ROOT, '<repo>'],
        ]) {
            if (token === prefix || token.startsWith(`${prefix}${path.sep}`)) {
                return `${label}${toPosix(token.slice(prefix.length))}`;
            }
        }
        return token;
    };
    const mapped = argv.map(swap);
    return mapped.map((t) => (t.startsWith('<repo>/') ? t.slice('<repo>/'.length) : t));
}

export function makeScratchDir() {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'pilot-verifier-'));
}

/** The binding file the verifier reads next to (not inside) the run directory. */
export function writeBindingFile(scratch, binding) {
    const file = path.join(scratch, 'dispatch-binding.json');
    writeCanonical(file, {schema: 'explorer-dispatch-binding/v1', ...binding});
    return file;
}

/**
 * Runs the verifier as a child process in `cwd` with `env`, kills it with SIGKILL when the budget runs out, and echoes
 * its output lines prefixed. Resolves with the facts process.json records; it never rejects.
 */
export function spawnVerifier({argv, cwd, env, timeoutSeconds, echo = (line) => process.stdout.write(`${line}\n`)}) {
    return new Promise((resolve) => {
        const started = process.hrtime.bigint();
        const done = {spawned: false, pid: null, exit_code: null, signal: null, timed_out: false, error: null};
        const lines = {stdout: [], stderr: []};
        let child;
        try {
            child = spawn(argv[0], argv.slice(1), {cwd, env, stdio: ['ignore', 'pipe', 'pipe'], shell: false});
        } catch (e) {
            resolve({...done, ...lines, elapsed_seconds: 0, error: String(e.message).slice(0, 200)});
            return;
        }
        done.spawned = true;
        done.pid = child.pid ?? null;
        const timer = setTimeout(() => {
            done.timed_out = true;
            child.kill('SIGKILL');
        }, timeoutSeconds * 1000);
        for (const stream of ['stdout', 'stderr']) {
            let pending = '';
            child[stream].on('data', (chunk) => {
                pending += chunk.toString('utf8');
                const parts = pending.split('\n');
                pending = parts.pop();
                for (const line of parts) {
                    lines[stream].push(line);
                    echo(`verifier| ${line}`);
                }
            });
            child[stream].on('end', () => {
                if (pending) {
                    lines[stream].push(pending);
                    echo(`verifier| ${pending}`);
                }
            });
        }
        const finish = (extra) => {
            clearTimeout(timer);
            resolve({
                ...done,
                ...extra,
                ...lines,
                elapsed_seconds: Number(process.hrtime.bigint() - started) / 1e9,
            });
        };
        child.on('error', (e) => finish({spawned: false, error: String(e.message).slice(0, 200)}));
        child.on('close', (code, signal) => finish({exit_code: code, signal}));
    });
}
