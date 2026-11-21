#!/usr/bin/env node
// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable no-process-env -- the wrapper passes a scrubbed environment to the agent command */

// Adapter between `--agents=cmd:<template>` and any tool that can answer a prompt. It reads the task file, builds a
// prompt from the role file plus the task's inputs and result schema, runs a supplied command with the prompt on
// stdin, validates what the command printed (or wrote) against the task's schema, and only then writes the result
// file. It refuses a result that carries a forbidden field, unsafe text or licence-like text. No vendor SDK, no
// vendor flag, no shell.
//
// node cmd-wrapper.mjs --task <agent-task.json> --result <agent-result.json> [--stub] [--print-prompt]
//                      [--timeout-seconds <n>] [--inline-limit <bytes>] [-- <command> [args...]]
//
// In the command arguments, {task}, {result} and {prompt_file} are replaced (the last writes the prompt to a
// temporary file that is removed afterwards). Exit codes: 0 result written; 1 refused (stale task, denied input,
// invalid or forbidden result; nothing written); 2 usage; 3 the command failed, timed out or printed no JSON.
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

import {EXIT} from '../lib/common.mjs';
import {buildPrompt, DEFAULT_INLINE_LIMIT, deniedInputs, roleEntryFor} from '../lib/prompt.mjs';
import {checkResult, loadTask, pairedResultPath, staleReasons, writeResult} from '../lib/result_check.mjs';
import {buildStubResult} from '../lib/stub.mjs';

const MAX_STDOUT_BYTES = 5 * 1024 * 1024;
const DEFAULT_TIMEOUT_SECONDS = 600;

class UsageError extends Error {}

export function parseWrapperArgs(argv) {
    const opts = {command: [], stub: false, printPrompt: false, timeout: DEFAULT_TIMEOUT_SECONDS};
    opts.inlineLimit = DEFAULT_INLINE_LIMIT;
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === '--') {
            opts.command = argv.slice(i + 1);
            break;
        }
        const value = () => {
            if (i + 1 >= argv.length) {
                throw new UsageError(`${arg} needs a value`);
            }
            return argv[++i];
        };
        if (arg === '--task') {
            opts.task = value();
        } else if (arg === '--result') {
            opts.result = value();
        } else if (arg === '--stub') {
            opts.stub = true;
        } else if (arg === '--print-prompt') {
            opts.printPrompt = true;
        } else if (arg === '--timeout-seconds') {
            opts.timeout = Number(value());
        } else if (arg === '--inline-limit') {
            opts.inlineLimit = Number(value());
        } else {
            throw new UsageError(`unknown argument ${arg}`);
        }
    }
    if (!opts.task || !opts.result) {
        throw new UsageError('--task and --result are required');
    }
    if (!Number.isFinite(opts.timeout) || opts.timeout <= 0 || !Number.isFinite(opts.inlineLimit)) {
        throw new UsageError('--timeout-seconds and --inline-limit must be numbers');
    }
    if (!opts.stub && !opts.printPrompt && opts.command.length === 0) {
        throw new UsageError('give a command after -- (or use --stub or --print-prompt)');
    }
    return opts;
}

/** Finds a JSON object in text: the whole text, a fenced block, or the outermost braces. */
export function extractJson(text) {
    const candidates = [text.trim()];
    for (const m of text.matchAll(/```(?:json)?\s*([\s\S]*?)```/g)) {
        candidates.push(m[1].trim());
    }
    const first = text.indexOf('{');
    const last = text.lastIndexOf('}');
    if (first >= 0 && last > first) {
        candidates.push(text.slice(first, last + 1));
    }
    for (const candidate of candidates) {
        try {
            const parsed = JSON.parse(candidate);
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                return parsed;
            }
        } catch {
            // try the next candidate
        }
    }
    return null;
}

function runCommand(argv, prompt, timeoutSeconds, env) {
    return new Promise((resolve) => {
        let stdout = '';
        let truncated = false;
        let timedOut = false;
        const child = spawn(argv[0], argv.slice(1), {env, stdio: ['pipe', 'pipe', 'inherit']});
        const timer = setTimeout(() => {
            timedOut = true;
            child.kill('SIGKILL');
        }, timeoutSeconds * 1000);
        child.stdout.on('data', (chunk) => {
            if (stdout.length + chunk.length > MAX_STDOUT_BYTES) {
                truncated = true;
            } else {
                stdout += chunk.toString('utf8');
            }
        });
        child.stdin.on('error', () => {
            // the command may exit without reading all of the prompt
        });
        child.stdin.end(prompt);
        child.on('error', () => {
            clearTimeout(timer);
            resolve({ok: false, reason: 'the command could not be started', stdout});
        });
        child.on('close', (code) => {
            clearTimeout(timer);
            let reason = `the command exited with ${code}`;
            if (timedOut) {
                reason = 'the command timed out';
            } else if (truncated) {
                reason = 'the command printed more than the output limit';
            }
            resolve({ok: code === 0 && !timedOut && !truncated, reason, stdout});
        });
    });
}

function fail(code, message, details = []) {
    process.stderr.write(`cmd-wrapper: ${message}\n`);
    for (const line of details) {
        process.stderr.write(`  ${line}\n`);
    }
    return code;
}

export async function main(argv) {
    let opts;
    try {
        opts = parseWrapperArgs(argv);
    } catch (e) {
        return fail(EXIT.USAGE, e.message);
    }
    const taskFile = path.resolve(opts.task);
    const resultFile = path.resolve(opts.result);

    let task;
    let roleEntry;
    try {
        task = loadTask(taskFile);
        if (path.resolve(pairedResultPath(taskFile)) !== resultFile) {
            return fail(EXIT.REFUSED, 'refusing: --result is not the result file of this task');
        }
        roleEntry = roleEntryFor(task);
    } catch (e) {
        return fail(EXIT.REFUSED, `refusing: ${e.message}`);
    }
    const stale = staleReasons(task, taskFile);
    if (stale.length > 0) {
        return fail(EXIT.REFUSED, 'refusing: the task is stale; run the orchestrator again to regenerate it', stale);
    }
    const denied = deniedInputs(task, roleEntry);
    if (denied.length > 0) {
        return fail(
            EXIT.REFUSED,
            `refusing: inputs the ${roleEntry.id} role must not see`,
            denied.map((d) => `${d.path} (matches ${d.glob})`),
        );
    }

    const prompt = buildPrompt(task, taskFile, roleEntry, {inlineLimit: opts.inlineLimit});
    if (opts.printPrompt) {
        process.stdout.write(prompt);
        return EXIT.OK;
    }

    let candidate;
    let promptDir;
    if (opts.stub) {
        candidate = await buildStubResult(task, taskFile);
    } else {
        const env = {...process.env, PILOT_AGENT_TASK: taskFile, PILOT_AGENT_RESULT: resultFile};
        delete env.MM_LICENSE;
        const needsFile = opts.command.some((a) => a.includes('{prompt_file}'));
        let promptFile = '';
        if (needsFile) {
            promptDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pilot-prompt-'));
            promptFile = path.join(promptDir, 'prompt.md');
            fs.writeFileSync(promptFile, prompt);
            env.PILOT_AGENT_PROMPT_FILE = promptFile;
        }
        const argv = opts.command.map((a) =>
            a.replaceAll('{task}', taskFile).replaceAll('{result}', resultFile).replaceAll('{prompt_file}', promptFile),
        );
        fs.rmSync(resultFile, {force: true});
        const ran = await runCommand(argv, prompt, opts.timeout, env);
        if (promptDir) {
            fs.rmSync(promptDir, {recursive: true, force: true});
        }
        if (!ran.ok) {
            fs.rmSync(resultFile, {force: true});
            return fail(EXIT.COMMAND_FAILED, ran.reason);
        }
        candidate = extractJson(ran.stdout);
        if (!candidate && fs.existsSync(resultFile)) {
            candidate = extractJson(fs.readFileSync(resultFile, 'utf8'));
        }
        fs.rmSync(resultFile, {force: true});
        if (!candidate) {
            return fail(EXIT.COMMAND_FAILED, 'the command printed no JSON object and wrote no result file');
        }
    }

    const verdict = checkResult(task, taskFile, candidate, roleEntry);
    if (!verdict.ok) {
        return fail(EXIT.REFUSED, 'refusing: the result is invalid or touches a forbidden field', verdict.errors);
    }
    writeResult(task, taskFile, candidate);
    process.stderr.write(`cmd-wrapper: wrote the result for ${task.task_id} (${roleEntry.id})\n`);
    return EXIT.OK;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    main(process.argv.slice(2)).then((code) => {
        process.exitCode = code;
    });
}
