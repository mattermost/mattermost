// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Constants and helpers shared by the CI scripts. Built-ins only; nothing here reads or prints a credential.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export const HERE = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(HERE, '../../..');

export const EXIT = {OK: 0, FAIL: 1, USAGE: 2, BLOCKED: 3, PENDING: 30};

export const POSTGRES_IMAGE = 'postgres:15.20@sha256:10f9e886f772e9d6484350b043bcf990ead67ae5d9988ddce265d72a299055d5';
export const SOURCE_REPOSITORY = 'mattermost/mattermost';

export const IMAGE_REPOSITORIES = {
    main: 'mattermostdevelopment/mattermost-enterprise-edition',
    release: 'mattermost/mattermost-enterprise-edition',
};

export const TARGET_FILES = {
    main: 'explorer-proto/v2/targets/main.json',
    release: 'explorer-proto/v2/orchestrator/targets/release.json',
};

export const ALLOWED = {
    target_kind: ['main', 'release'],
    session: ['bookmarks'],
    control: ['release-bookmark-title-changed'],
    verifier: ['process'],
};

export const BUDGET_MINUTES = {min: 15, max: 90, default: 45};

export const COMMIT_PATTERNS = {
    main: /^[0-9a-f]{40}$/,
    release: /^v\d+\.\d+\.\d+(?:-rc\d+)?$/,
};

export const IMAGE_PATTERN =
    /^([a-z0-9]+(?:[._-][a-z0-9]+)*\/[a-z0-9]+(?:[._-][a-z0-9]+)*):([A-Za-z0-9_][A-Za-z0-9._-]{0,127})@sha256:([0-9a-f]{64})$/;

export const ADVISORY_SENTENCE =
    'ADVISORY: does not gate merges or releases; existing release checks remain authoritative';

/** Stages in the order the summary lists them. */
export const STAGES = [
    ['inputs', 'Workflow inputs validated'],
    ['facts', 'Revisions recorded'],
    ['provenance', 'Commit to image provenance (registry or build record)'],
    ['setup', 'Playwright workspace and Chromium'],
    ['images', 'Images pulled and verified by digest'],
    ['capture-config', 'Screenshots, video and trace off'],
    ['containment', 'Local-fixture containment (guard-check)'],
    ['containment-journey', 'Local-fixture containment (guard-journey)'],
    ['gate', 'Infra isolation and licence gate'],
    ['licence', 'Licence check (IsLicensed === true)'],
    ['provenance-live', 'Server build hash equals the target commit'],
    ['coordinator', 'Coordinator run (pilot.mjs run)'],
    ['teardown', 'Stack teardown'],
    ['export', 'Sanitized export'],
    ['capture-export', 'No screenshot, video or trace in the export'],
    ['leak-scan', 'Leak scan of the export'],
];

export const RESULTS = ['PASS', 'FAIL', 'BLOCKED', 'PENDING', 'SKIPPED'];

export class InputError extends Error {}

/** A value that is safe to echo into a log line: one line, bounded, no workflow-command prefix. */
export function safeText(value, max = 80) {
    const text = String(value ?? '')
        .replace(/[\r\n\t]+/g, ' ')
        .replace(/::/g, ': ')
        .slice(0, max);
    return JSON.stringify(text);
}

export function parseImage(ref) {
    const match = IMAGE_PATTERN.exec(String(ref ?? ''));
    if (!match) {
        return null;
    }
    return {
        ref,
        repository: match[1],
        tag: match[2],
        digest: `sha256:${match[3]}`,
        hex: match[3],
        digest_short: match[3].slice(0, 12),
    };
}

export function ciDir(env = process.env) {
    return path.resolve(env.EXPLORER_CI_DIR || path.join(REPO_ROOT, 'explorer-proto/infra/.run/ci'));
}

export function readJson(file) {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function sortKeys(value) {
    if (Array.isArray(value)) {
        return value.map(sortKeys);
    }
    if (value && typeof value === 'object') {
        return Object.fromEntries(
            Object.keys(value)
                .sort()
                .map((key) => [key, sortKeys(value[key])]),
        );
    }
    return value;
}

export function canonicalJson(value) {
    return `${JSON.stringify(sortKeys(value), null, 2)}\n`;
}

export function writeJson(file, value) {
    fs.mkdirSync(path.dirname(file), {recursive: true});
    fs.writeFileSync(file, canonicalJson(value));
}

export function sha256File(file) {
    return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

export function parseArgs(argv) {
    const flags = {};
    const positional = [];
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === '--') {
            positional.push(...argv.slice(i + 1));
            break;
        }
        if (arg.startsWith('--')) {
            const eq = arg.indexOf('=');
            if (eq !== -1) {
                flags[arg.slice(2, eq)] = arg.slice(eq + 1);
            } else if (i + 1 < argv.length && !argv[i + 1].startsWith('--') && VALUE_FLAGS.has(arg.slice(2))) {
                flags[arg.slice(2)] = argv[++i];
            } else {
                flags[arg.slice(2)] = true;
            }
        } else {
            positional.push(arg);
        }
    }
    return {flags, positional};
}

const VALUE_FLAGS = new Set([
    'kind',
    'image',
    'commit',
    'build-record',
    'out',
    'provenance',
    'base-url',
    'config',
    'export',
    'root',
    'github-summary-file',
    'pilot-summary',
    'blocked-codes',
    'pending-codes',
]);

/** Appends key=value to $GITHUB_OUTPUT when it is set. Values are validated upstream and never contain a newline. */
export function appendOutput(key, value, env = process.env) {
    if (!env.GITHUB_OUTPUT) {
        return;
    }
    if (/[\r\n]/.test(String(value))) {
        throw new Error(`output ${key} holds a newline`);
    }
    fs.appendFileSync(env.GITHUB_OUTPUT, `${key}=${value}\n`);
}

export function annotate(level, title, message) {
    process.stdout.write(`::${level} title=${title}::${String(message).replace(/[\r\n]+/g, ' ')}\n`);
}

export function isMain(metaUrl) {
    return process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(metaUrl);
}
