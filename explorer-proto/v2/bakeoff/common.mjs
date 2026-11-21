// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Small helpers shared by the bakeoff scripts. Built-ins only; no network access.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

import {UNSAFE_TEXT_PATTERN} from '../schemas/shared.mjs';

export const BAKEOFF_DIR = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(BAKEOFF_DIR, '../../..');
export const RULES_FILE = path.join(BAKEOFF_DIR, 'rules.json');
export const FREEZE_FILE = path.join(BAKEOFF_DIR, 'FREEZE.json');
export const PREREGISTRATION_FILE = path.join(BAKEOFF_DIR, 'PREREGISTRATION.md');

export function readJson(file) {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
}

export function sha256Text(text) {
    return crypto.createHash('sha256').update(text).digest('hex');
}

export function sha256File(file) {
    return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function sortKeys(value) {
    if (Array.isArray(value)) {
        return value.map(sortKeys);
    }
    if (value && typeof value === 'object') {
        return Object.fromEntries(
            Object.keys(value)
                .sort()
                .map((k) => [k, sortKeys(value[k])]),
        );
    }
    return value;
}

// Canonical form: sorted object keys, 4-space indent, trailing newline. Array order is kept.
export function canonicalJson(value) {
    return `${JSON.stringify(sortKeys(value), null, 4)}\n`;
}

export function writeJson(file, value) {
    const tmp = `${file}.tmp-${process.pid}`;
    fs.writeFileSync(tmp, canonicalJson(value));
    fs.renameSync(tmp, file);
}

export function isMain(metaUrl) {
    return process.argv[1] !== undefined && pathToFileURL(fs.realpathSync(process.argv[1])).href === metaUrl;
}

// Refuses to persist text that carries an origin, loopback host, session material or a 26-character id.
export function assertSanitized(text, what) {
    if (new RegExp(UNSAFE_TEXT_PATTERN).test(text)) {
        throw new Error(`${what} contains text that must not be recorded`);
    }
}

// Flags: --name value, --name=value, --flag (boolean). Repeatable flags collect into arrays.
// Everything after a bare "--" is returned untouched in `rest`.
export function parseArgs(argv, {booleans = [], repeatable = []} = {}) {
    const flags = {};
    const positional = [];
    let rest = [];
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === '--') {
            rest = argv.slice(i + 1);
            break;
        }
        if (!arg.startsWith('--')) {
            positional.push(arg);
            continue;
        }
        const eq = arg.indexOf('=');
        const name = eq === -1 ? arg.slice(2) : arg.slice(2, eq);
        let value = true;
        if (!booleans.includes(name)) {
            value = eq === -1 ? argv[++i] : arg.slice(eq + 1);
            if (value === undefined) {
                throw new Error(`--${name} needs a value`);
            }
        }
        if (repeatable.includes(name)) {
            (flags[name] ??= []).push(value);
        } else {
            flags[name] = value;
        }
    }
    return {flags, positional, rest};
}

export function relativeToRepo(file) {
    return path.relative(REPO_ROOT, path.resolve(file)).split(path.sep).join('/');
}
