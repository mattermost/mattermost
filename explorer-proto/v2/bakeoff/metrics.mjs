#!/usr/bin/env node
// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Wraps one stage command and appends a sanitized cost record to a result set.
//   node metrics.mjs --result <result.json> --stage <id> [--category pipeline|measurement]
//                    [--agent-calls <agent-calls.jsonl>] -- <command> [args...]
// Records: exit code (or signal), elapsed seconds, and the number of agent calls, counted as the JSON-object lines the
// stage appended to agent-calls.jsonl while it ran. The command's output is inherited, never captured or stored, and
// only the executable's base name and the argument count are recorded. Exit code: the command's own, else 1 or 3.
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import {createValidators} from '../schemas/validator.mjs';

import {assertSanitized, isMain, parseArgs, readJson} from './common.mjs';
import {saveResult} from './result_set.mjs';

export function countAgentCalls(file) {
    if (!file || !fs.existsSync(file)) {
        return {calls: 0, malformed: 0, present: false};
    }
    let calls = 0;
    let malformed = 0;
    for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
        if (line.trim() === '') {
            continue;
        }
        try {
            const value = JSON.parse(line);
            if (value && typeof value === 'object' && !Array.isArray(value)) {
                calls++;
            } else {
                malformed++;
            }
        } catch {
            malformed++;
        }
    }
    return {calls, malformed, present: true};
}

export function stageRecord({
    stage,
    category,
    command,
    argCount,
    status,
    signal,
    elapsedSeconds,
    before,
    after,
    startedAt,
    endedAt,
}) {
    const record = {
        stage,
        category,
        command_name: path.basename(command),
        arg_count: argCount,
        exit_code: status,
        elapsed_seconds: Math.round(elapsedSeconds * 1000) / 1000,
        agent_calls: Math.max(0, after.calls - before.calls),
        agent_calls_file_present: after.present,
        agent_calls_malformed_lines: Math.max(0, after.malformed - before.malformed),
        volatile: {started_at: startedAt, ended_at: endedAt},
    };
    if (signal) {
        record.signal = signal;
    }
    return record;
}

function main(argv) {
    const {flags, rest} = parseArgs(argv);
    const category = flags.category ?? 'pipeline';
    if (!flags.result || !flags.stage || rest.length === 0 || !['pipeline', 'measurement'].includes(category)) {
        process.stderr.write(
            'usage: metrics.mjs --result <file> --stage <id> [--category pipeline|measurement] [--agent-calls <jsonl>] -- <command> [args...]\n',
        );
        return 2;
    }
    let result;
    try {
        result = readJson(flags.result);
    } catch {
        process.stderr.write('result file is missing or not JSON; create it with result_set.mjs init\n');
        return 2;
    }

    const [command, ...args] = rest;
    const before = countAgentCalls(flags['agent-calls']);
    const startedAt = new Date().toISOString();
    const t0 = process.hrtime.bigint();
    const child = spawnSync(command, args, {stdio: 'inherit', env: process.env});
    const elapsedSeconds = Number(process.hrtime.bigint() - t0) / 1e9;
    const endedAt = new Date().toISOString();
    const after = countAgentCalls(flags['agent-calls']);

    const childCode = child.error ? 127 : (child.status ?? 1);
    try {
        const record = stageRecord({
            stage: flags.stage,
            category,
            command,
            argCount: args.length,
            status: child.status ?? null,
            signal: child.signal,
            elapsedSeconds,
            before,
            after,
            startedAt,
            endedAt,
        });
        assertSanitized(JSON.stringify(record), 'stage record');
        result.cost ??= {stages: []};
        result.cost.stages.push(record);
        saveResult(createValidators(), flags.result, result);
    } catch (e) {
        process.stderr.write(`metrics: ${e.message}\n`);
        return childCode === 0 ? 3 : childCode;
    }
    return childCode;
}

if (isMain(import.meta.url)) {
    process.exitCode = main(process.argv.slice(2));
}
