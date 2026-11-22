// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Paths, hashing, canonical JSON and exit codes shared by the orchestrator. Built-ins plus the bakeoff helpers only.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

import {canonicalJson, isMain, parseArgs, readJson, sha256File, sha256Text} from '../../bakeoff/common.mjs';

export {canonicalJson, isMain, parseArgs, readJson, sha256File, sha256Text};

export const ORCH_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const V2_DIR = path.resolve(ORCH_DIR, '..');
export const PROTO_DIR = path.resolve(V2_DIR, '..');
export const REPO_ROOT = path.resolve(PROTO_DIR, '..');
export const ORCH_REPO_PATH = 'explorer-proto/v2/orchestrator';
export const ORCH_VERIFIER_DIR = path.join(ORCH_DIR, 'verifier');
export const INFRA_DIR = path.join(PROTO_DIR, 'infra');
export const ORCH_RUNS_DIR = path.join(INFRA_DIR, '.run', 'orch');

export const EXIT = {
    OK: 0,
    FAIL: 1,
    USAGE: 2,
    BLOCKED: 3,
    AWAITING_AGENT: 20,
    AGENT_INVALID: 21,
    AGENT_FAILED: 22,
    INCOMPLETE: 30,
};

/** What each exit code of `pilot.mjs run` means; the README's headless CI contract and the run plan print this table. */
export const EXIT_MEANING = {
    0: 'pass',
    1: 'fail (a stage failed or the verifier did not reproduce the controlled failure)',
    2: 'usage error',
    3: 'blocked (a precondition is missing, or the verifier reported blocked)',
    20: 'awaiting a manual agent result',
    21: 'an agent result was invalid or stale and was set aside',
    22: 'the agent command failed to run cleanly',
    30: 'pending/incomplete (verification missing, rejected or unbound; never a pass)',
};

export const STAGE_NAMES = [
    'target',
    'index',
    'explore',
    'triage',
    'select',
    'discover',
    'emit',
    'verify',
    'promote',
    'lessons',
];

export const MODES = ['explore', 'author', 'both'];

/** The two stage layouts: the ten-stage pipeline and the five-stage verification of an existing spec. */
export const STAGE_SETS = {
    pipeline: {id: 'pipeline', names: STAGE_NAMES, dirs: STAGE_NAMES.map((n, i) => `${i}-${n}`)},
    verify_spec: {
        id: 'verify_spec',
        names: ['target', 'baseline', 'control', 'dispatch', 'collect'],
        dirs: ['0-target', '1-baseline', '2-control', 'verify', 'collect'],
    },
};

export function stageDirName(index, set = STAGE_SETS.pipeline) {
    return set.dirs[index];
}

/** Thrown by a stage to stop the pipeline with a specific exit code (awaiting agent, invalid agent result, ...). */
export class StageSignal extends Error {
    constructor(exitCode, status, message, extra = {}) {
        super(message);
        this.exitCode = exitCode;
        this.status = status;
        this.extra = extra;
    }
}

export function sha256Json(value) {
    return sha256Text(canonicalJson(value));
}

export function toPosix(p) {
    return p.split(path.sep).join('/');
}

export function repoRel(abs) {
    return toPosix(path.relative(REPO_ROOT, abs));
}

export function slug(id) {
    return String(id).replace(/[^A-Za-z0-9_.-]+/g, '_');
}

export function writeFileAtomic(file, text) {
    fs.mkdirSync(path.dirname(file), {recursive: true});
    const tmp = `${file}.tmp-${process.pid}`;
    fs.writeFileSync(tmp, text);
    fs.renameSync(tmp, file);
}

export function writeCanonical(file, value) {
    writeFileAtomic(file, canonicalJson(value));
}

export function writeJsonl(file, rows) {
    writeFileAtomic(file, rows.map((r) => JSON.stringify(r)).join('\n') + (rows.length ? '\n' : ''));
}

/** Sorted, forward-slash relative paths of every file below dir (empty when dir does not exist). */
export function listFiles(dir, {skip = () => false} = {}) {
    const out = [];
    const walk = (current) => {
        for (const entry of fs.readdirSync(current, {withFileTypes: true}).sort((a, b) => (a.name < b.name ? -1 : 1))) {
            const abs = path.join(current, entry.name);
            const relative = toPosix(path.relative(dir, abs));
            if (skip(relative, entry)) {
                continue;
            }
            if (entry.isDirectory()) {
                walk(abs);
            } else if (entry.isFile()) {
                out.push(relative);
            }
        }
    };
    if (fs.existsSync(dir)) {
        walk(dir);
    }
    return out;
}

export function hashFiles(dir, files) {
    return Object.fromEntries(files.map((f) => [f, sha256File(path.join(dir, f))]));
}

export function sleep(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms).unref();
    });
}

export function newId(prefix, ...parts) {
    return `${prefix}-${crypto.createHash('sha1').update(parts.join('\n')).digest('hex').slice(0, 10)}`;
}

/** Text of a file that may not exist. */
export function readTextIfExists(file) {
    return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
}
