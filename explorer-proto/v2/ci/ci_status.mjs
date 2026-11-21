#!/usr/bin/env node
// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Stage ledger for one CI run (<ci dir>/ci-status.json). Details are fixed strings, never command output.
//   ci_status.mjs record <stage> <PASS|FAIL|BLOCKED|PENDING|SKIPPED> [detail...]
//   ci_status.mjs run [--blocked-codes 3] [--pending-codes 30] <stage> -- <command> [args...]
//   ci_status.mjs show
// `run` keeps the command's own exit code, so the workflow step fails exactly as the command did.
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import {annotate, ciDir, EXIT, isMain, parseArgs, readJson, REPO_ROOT, RESULTS, STAGES, writeJson} from './lib.mjs';

const LEDGER = 'ci-status.json';

export function ledgerPath(env = process.env) {
    return path.join(ciDir(env), LEDGER);
}

export function readLedger(env = process.env) {
    try {
        return readJson(ledgerPath(env));
    } catch {
        return {schema: 'explorer-ci-status/v1', stages: {}};
    }
}

export function recordStage(stage, result, detail = '', env = process.env) {
    if (!STAGES.some(([id]) => id === stage)) {
        throw new Error(`unknown stage ${stage}`);
    }
    if (!RESULTS.includes(result)) {
        throw new Error(`unknown result ${result}`);
    }
    const ledger = readLedger(env);
    ledger.stages[stage] = {
        result,
        detail: String(detail)
            .replace(/[\r\n]+/g, ' ')
            .slice(0, 200),
    };
    writeJson(ledgerPath(env), ledger);
}

function codeSet(value, fallback) {
    return new Set(
        String(value ?? fallback)
            .split(',')
            .filter(Boolean)
            .map(Number),
    );
}

export function resultForExit(code, {blocked = new Set([3]), pending = new Set([30])} = {}) {
    if (code === 0) {
        return 'PASS';
    }
    if (blocked.has(code)) {
        return 'BLOCKED';
    }
    return pending.has(code) ? 'PENDING' : 'FAIL';
}

function run(flags, positional) {
    const [stage, ...command] = positional;
    if (!stage || command.length === 0) {
        process.stderr.write('usage: ci_status.mjs run [--blocked-codes 3] <stage> -- <command...>\n');
        return EXIT.USAGE;
    }
    const child = spawnSync(command[0], command.slice(1), {stdio: 'inherit', cwd: REPO_ROOT});
    const code = child.status ?? 1;
    const result = resultForExit(code, {
        blocked: codeSet(flags['blocked-codes'], '3'),
        pending: codeSet(flags['pending-codes'], '30'),
    });
    const detail = child.status === null ? `terminated by ${child.signal ?? 'a signal'}` : `exit ${code}`;
    recordStage(stage, result, detail);
    if (result !== 'PASS') {
        annotate('error', `exploratory ${stage}`, `${stage} ${result} (${detail})`);
    }
    return child.status === null ? 1 : code;
}

function main() {
    const [command, ...rest] = process.argv.slice(2);
    const {flags, positional} = parseArgs(rest);
    if (command === 'record') {
        const [stage, result, ...detail] = positional;
        try {
            recordStage(stage, result, detail.join(' '));
        } catch (error) {
            process.stderr.write(`${error.message}\n`);
            return EXIT.USAGE;
        }
        return EXIT.OK;
    }
    if (command === 'run') {
        return run(flags, positional);
    }
    if (command === 'show') {
        process.stdout.write(fs.existsSync(ledgerPath()) ? fs.readFileSync(ledgerPath(), 'utf8') : '{}\n');
        return EXIT.OK;
    }
    process.stderr.write('usage: ci_status.mjs <record|run|show> ...\n');
    return EXIT.USAGE;
}

if (isMain(import.meta.url)) {
    process.exit(main());
}
