// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Shared helpers for the v2 gates. Node built-ins only; no network; no timestamps in any output.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export const GATES_DIR = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(GATES_DIR, '../../..');

// Exit codes shared by every gate CLI. USAGE covers bad arguments and unreadable inputs that are not evidence.
export const EXIT = {PASS: 0, FAIL: 1, USAGE: 2, BLOCKED: 3};

export const STATUSES = ['pass', 'fail', 'blocked'];

export function exitCodeFor(status) {
    if (status === 'pass') {
        return EXIT.PASS;
    }
    return status === 'fail' ? EXIT.FAIL : EXIT.BLOCKED;
}

// Worst of several statuses: fail beats blocked beats pass.
export function worstStatus(...statuses) {
    if (statuses.includes('fail')) {
        return 'fail';
    }
    return statuses.includes('blocked') ? 'blocked' : 'pass';
}

export class UsageError extends Error {}

export function sha256(data) {
    return crypto.createHash('sha256').update(data).digest('hex');
}

export function stripAnsi(s) {
    // eslint-disable-next-line no-control-regex
    return String(s ?? '').replace(/\u001b\[[0-9;]*m/g, '');
}

// First message line only, with origins and server ids masked (never message bodies).
export function maskFirstLine(message) {
    return stripAnsi(message)
        .split('\n')[0]
        .replace(/[a-z][a-z0-9+.-]*:\/\/[^\s'"]+/gi, '<url>')
        .replace(/\bID: \w+/g, 'ID: <id>')
        .replace(/\b(?=[a-z0-9]*\d)[a-z0-9]{26}\b/g, '<id>')
        .slice(0, 200);
}

export function readJsonFile(file) {
    let text;
    try {
        text = fs.readFileSync(file, 'utf8');
    } catch {
        throw new UsageError(`cannot read ${path.basename(file)}`);
    }
    try {
        return JSON.parse(text);
    } catch {
        throw new UsageError(`${path.basename(file)} is not JSON`);
    }
}

// Runs a gate body so that a crash can never read as a pass.
export function guarded(body) {
    try {
        return body();
    } catch (error) {
        const detail = error instanceof UsageError ? error.message : `internal error: ${error?.name ?? 'Error'}`;
        return {status: 'blocked', evidence: [{rule: 'input', detail}]};
    }
}

export async function guardedAsync(body) {
    try {
        return await body();
    } catch (error) {
        const detail = error instanceof UsageError ? error.message : `internal error: ${error?.name ?? 'Error'}`;
        return {status: 'blocked', evidence: [{rule: 'input', detail}]};
    }
}

export function splitOnce(text, separator) {
    const index = text.indexOf(separator);
    return index < 0 ? [text, undefined] : [text.slice(0, index), text.slice(index + separator.length)];
}

export function compareStrings(a, b) {
    if (a === b) {
        return 0;
    }
    return a < b ? -1 : 1;
}

// The errors recorded on one Playwright test result (`errors`, or the legacy single `error`).
export function resultErrors(result) {
    if (result.errors?.length) {
        return result.errors;
    }
    return result.error ? [result.error] : [];
}

// Minimal argument parser. spec: {flags: [names], options: [names], multi: [names]}; returns {positional, values}.
export function parseArgs(argv, spec = {}) {
    const flags = new Set(spec.flags ?? []);
    const options = new Set(spec.options ?? []);
    const multi = new Set(spec.multi ?? []);
    const values = {};
    const positional = [];
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (!arg.startsWith('--')) {
            positional.push(arg);
            continue;
        }
        const [rawName, inline] = splitOnce(arg.slice(2), '=');
        if (flags.has(rawName)) {
            values[rawName] = true;
        } else if (options.has(rawName) || multi.has(rawName)) {
            const value = inline ?? argv[++i];
            if (value === undefined) {
                throw new UsageError(`--${rawName} needs a value`);
            }
            if (multi.has(rawName)) {
                (values[rawName] ??= []).push(value);
            } else {
                values[rawName] = value;
            }
        } else {
            throw new UsageError(`unknown option --${rawName}`);
        }
    }
    return {positional, values};
}

export function positiveInt(value, name) {
    const n = Number(value);
    if (!Number.isInteger(n) || n < 1) {
        throw new UsageError(`${name} must be a positive integer`);
    }
    return n;
}

export function printJson(value) {
    process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

// Runs a CLI main and sets the exit code; usage errors exit 2 with a one-line message on stderr.
export async function runCli(main) {
    try {
        const code = await main();
        process.exitCode = code;
    } catch (error) {
        if (error instanceof UsageError) {
            process.stderr.write(`${error.message}\n`);
            process.exitCode = EXIT.USAGE;
            return;
        }
        throw error;
    }
}

// Flattens a Playwright JSON report into one record per test (spec title, file, test object).
export function walkReport(report) {
    const tests = [];
    const walk = (suite) => {
        for (const spec of suite.specs ?? []) {
            for (const test of spec.tests ?? []) {
                tests.push({title: String(spec.title ?? ''), file: spec.file ?? suite.file ?? '', test});
            }
        }
        for (const child of suite.suites ?? []) {
            walk(child);
        }
    };
    (report.suites ?? []).forEach(walk);
    return tests;
}

export function looksLikePlaywrightReport(report) {
    return (
        report !== null &&
        typeof report === 'object' &&
        Array.isArray(report.suites) &&
        (report.stats === undefined || typeof report.stats === 'object')
    );
}

// Handles that name automation are never accepted as a human approver.
const AUTOMATION_HANDLE =
    /(?:^|[-_.])(agent|bot|cursor|claude|gpt|llm|ai|auto|automation|orchestrator|system|ci|cron)(?:$|[-_.\d])/i;

export function isHumanApprover(name) {
    if (typeof name !== 'string') {
        return false;
    }
    const trimmed = name.trim();
    return trimmed.length > 0 && /^[a-z0-9][a-z0-9_-]{0,38}$/.test(trimmed) && !AUTOMATION_HANDLE.test(trimmed);
}
