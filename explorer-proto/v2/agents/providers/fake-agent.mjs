#!/usr/bin/env node
// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable no-process-env -- the mode and the task path come from the environment by design */

// A deterministic stand-in for an agent tool, used to test cmd-wrapper.mjs and to check the plumbing of a `cmd:`
// template without any vendor tool. It reads the prompt on stdin, finds the task through PILOT_AGENT_TASK (set by
// the wrapper), and prints a canned schema-valid result. A first argument names a prompt file to read instead of
// stdin (the {prompt_file} form). FAKE_AGENT_MODE plants a defect for the refusal tests:
// route-field, approver, origin, licence, wrong-task-id, garbage, fail, fenced. Never use it for a real run.
import fs from 'node:fs';

import {loadTask} from '../lib/result_check.mjs';
import {buildStubResult} from '../lib/stub.mjs';

const MODES = ['ok', 'route-field', 'approver', 'origin', 'licence', 'wrong-task-id', 'garbage', 'fail', 'fenced'];

function readStdin() {
    return fs.readFileSync(0, 'utf8');
}

function appendToFirstString(value, suffix) {
    if (typeof value === 'string') {
        return {done: true, value: `${value} ${suffix}`};
    }
    if (value && typeof value === 'object') {
        for (const key of Object.keys(value)) {
            const hit = appendToFirstString(value[key], suffix);
            if (hit.done) {
                value[key] = hit.value;
                return {done: true, value};
            }
        }
    }
    return {done: false, value};
}

async function main() {
    const mode = process.env.FAKE_AGENT_MODE ?? 'ok';
    if (!MODES.includes(mode)) {
        process.stderr.write(`fake-agent: unknown FAKE_AGENT_MODE (known: ${MODES.join(', ')})\n`);
        return 2;
    }
    const prompt = process.argv[2] ? fs.readFileSync(process.argv[2], 'utf8') : readStdin();
    const taskFile = process.env.PILOT_AGENT_TASK;
    if (!taskFile) {
        process.stderr.write('fake-agent: PILOT_AGENT_TASK is not set\n');
        return 2;
    }
    const task = loadTask(taskFile);
    const expected = [`# Agent task ${task.task_id}`, '## Contract', '## Role:', '## Inputs', '## Output'];
    const missing = expected.filter((marker) => !prompt.includes(marker));
    if (missing.length > 0) {
        process.stderr.write(`fake-agent: the prompt lacks ${missing.length} expected section(s)\n`);
        return 9;
    }
    if (mode === 'fail') {
        return 7;
    }
    if (mode === 'garbage') {
        process.stdout.write('I could not produce a result for this task.\n');
        return 0;
    }
    const result = await buildStubResult(task, taskFile);
    if (mode === 'route-field') {
        result.route_hint = 'not allowed';
    } else if (mode === 'approver') {
        result.approver = 'someone';
    } else if (mode === 'origin') {
        appendToFirstString(
            result.proposals ?? result.reviews ?? result.lessons ?? result.classifications,
            'see http://example.invalid:8065/x',
        );
    } else if (mode === 'licence') {
        const token = `eyJ${'a'.repeat(20)}.${'b'.repeat(20)}`;
        appendToFirstString(result.proposals ?? result.reviews ?? result.lessons ?? result.classifications, token);
    } else if (mode === 'wrong-task-id') {
        result.task_id = `${result.task_id}-other`;
    }
    const text = JSON.stringify(result, null, 2);
    process.stdout.write(mode === 'fenced' ? `Here is the result.\n\`\`\`json\n${text}\n\`\`\`\n` : `${text}\n`);
    return 0;
}

main().then(
    (code) => {
        process.exitCode = code;
    },
    (e) => {
        process.stderr.write(`fake-agent: ${e.message}\n`);
        process.exitCode = 1;
    },
);
