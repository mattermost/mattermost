// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable @stylistic/wrap-regex, no-await-in-loop, no-process-env -- Prettier owns formatting and the repo config relaxes these rules for .ts/.js only; the awaits run in order by design */

// The agent boundary. A stage that needs judgement writes <stage>/agent-task.json and obtains <stage>/agent-result.json
// from a provider: "manual" (stop with exit 20, any tool or person drops the file), "cmd:<template>" (a user-supplied
// command with {task} and {result}) or "stub[:scenario]" (canned results, tests only). The orchestrator never names a
// vendor. A result is validated against the task's output schema before it is used, and is advisory only.
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import {BudgetExceeded} from './budgets.mjs';
import {
    EXIT,
    ORCH_REPO_PATH,
    REPO_ROOT,
    sha256File,
    sha256Json,
    StageSignal,
    toPosix,
    writeCanonical,
} from './common.mjs';
import {localSchemaPath, validate, validateWithSchema} from './schemas.mjs';
import {stubResult} from './stub_agent.mjs';

import {FORBIDDEN_KEY_WORDS} from '../../schemas/shared.mjs';

export const READ_ONLY_TOOLS = ['read_file', 'list_directory', 'search_repo_text'];

const FORBIDDEN_CONTENT = [
    'origin, loopback host or port of any running server',
    'session tokens, passwords or licence material',
    '26-character server ids',
    'ordered steps, routes or named controls to click in a charter',
];

const RESULT_SCHEMA_FILE = 'schemas/agent-results.schema.json';

export function parseAgents(spec) {
    if (spec === 'manual') {
        return {kind: 'manual'};
    }
    const stub = /^stub(?::([a-z-]+))?$/.exec(spec);
    if (stub) {
        return {kind: 'stub', scenario: stub[1] ?? 'default'};
    }
    if (spec.startsWith('cmd:') && spec.length > 4) {
        return {kind: 'cmd', template: spec.slice(4)};
    }
    throw new Error(
        `bad --agents "${spec}" (expected manual, stub[:scenario] or cmd:<template with {task} and {result}>)`,
    );
}

/** Splits a command template into argv without a shell: single and double quotes and backslash escapes only. */
export function splitCommand(template) {
    const argv = [];
    let current = '';
    let quote = null;
    let started = false;
    for (let i = 0; i < template.length; i++) {
        const c = template[i];
        if (quote) {
            if (c === quote) {
                quote = null;
            } else if (c === '\\' && quote === '"' && i + 1 < template.length) {
                current += template[++i];
            } else {
                current += c;
            }
        } else if (c === '"' || c === "'") {
            quote = c;
            started = true;
        } else if (c === '\\' && i + 1 < template.length) {
            current += template[++i];
            started = true;
        } else if (/\s/.test(c)) {
            if (started) {
                argv.push(current);
                current = '';
                started = false;
            }
        } else {
            current += c;
            started = true;
        }
    }
    if (quote) {
        throw new Error('unterminated quote in the agent command template');
    }
    if (started) {
        argv.push(current);
    }
    return argv;
}

function fileRef(ctx, input) {
    const abs = input.base === 'repo' ? path.join(REPO_ROOT, input.path) : path.join(ctx.out, input.path);
    return {path: toPosix(input.path), base: input.base, sha256: sha256File(abs), purpose: input.purpose};
}

function stripUndefined(obj) {
    return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));
}

/**
 * spec: {role, name?, prompt, inputs: [{path, base, purpose}], schemaRef: "agent#select" | dynamicSchema: object,
 *        allowedTools?, extraTools?, check?: (result) => string[]}
 */
export function buildTask(ctx, spec, resultRel, schemaInfo) {
    const promptRepo = `${ORCH_REPO_PATH}/prompts/${spec.prompt}`;
    const body = {
        stage: ctx.name,
        role: spec.role,
        prompt: {file: promptRepo, sha256: sha256File(path.join(REPO_ROOT, promptRepo))},
        inputs: spec.inputs.map((i) => stripUndefined(fileRef(ctx, i))),
        output: {result_file: resultRel, result_schema: schemaInfo},
        allowed_tools: [...READ_ONLY_TOOLS, ...(spec.extraTools ?? []), `write_file:${resultRel}`],
        forbidden: {fields: FORBIDDEN_KEY_WORDS, content: FORBIDDEN_CONTENT},
        caps: {agent_calls: ctx.budget.agent_calls, retries: ctx.budget.retries},
    };
    const taskId = `${ctx.name}-${spec.role}-${sha256Json(body).slice(0, 10)}`;
    return {schema: 'explorer-agent-task/v1', task_id: taskId, ...body};
}

function resolveSchema(ctx, spec, suffix) {
    if (spec.dynamicSchema) {
        const file = `agent-schema${suffix}.json`;
        writeCanonical(path.join(ctx.dir, file), spec.dynamicSchema);
        const rel = `${ctx.stageDirName}/${file}`;
        return {
            id: spec.role,
            file: rel,
            base: 'out',
            sha256: sha256File(path.join(ctx.out, rel)),
            definition: undefined,
        };
    }
    const [, definition] = spec.schemaRef.split('#');
    return {
        id: spec.schemaRef,
        file: `${ORCH_REPO_PATH}/${RESULT_SCHEMA_FILE}`,
        base: 'repo',
        sha256: sha256File(localSchemaPath('agent-results.schema.json')),
        definition,
    };
}

function readResult(file) {
    try {
        return {data: JSON.parse(fs.readFileSync(file, 'utf8'))};
    } catch {
        return {errors: ['/: result file is not valid JSON']};
    }
}

function checkResult(ctx, spec, task, data) {
    const verdict = spec.dynamicSchema ? validateWithSchema(spec.dynamicSchema, data) : validate(spec.schemaRef, data);
    const errors = [...verdict.errors];
    if (verdict.ok && data.task_id !== task.task_id) {
        errors.push('/task_id: does not match the task (stale or foreign result)');
    }
    if (verdict.ok && errors.length === 0 && spec.check) {
        errors.push(...spec.check(data));
    }
    return errors;
}

async function invoke(ctx, provider, task, taskAbs, resultAbs) {
    const remainingMs = Math.max(0, ctx.remainingSeconds() * 1000);
    if (provider.kind === 'stub') {
        const call = (async () => {
            const result = await stubResult(task, ctx, provider.scenario);
            fs.writeFileSync(resultAbs, JSON.stringify(result, null, 4));
        })();
        let timer;
        const timeout = new Promise((_, reject) => {
            timer = setTimeout(
                () => reject(new BudgetExceeded('time_exceeded', 'agent call exceeded the stage time budget')),
                remainingMs,
            );
        });
        try {
            await Promise.race([call, timeout]);
        } finally {
            clearTimeout(timer);
        }
        return {ok: true};
    }
    const argv = splitCommand(provider.template).map((a) =>
        a.replaceAll('{task}', taskAbs).replaceAll('{result}', resultAbs),
    );
    const env = {...process.env, PILOT_AGENT_TASK: taskAbs, PILOT_AGENT_RESULT: resultAbs};
    delete env.MM_LICENSE;
    return new Promise((resolve) => {
        let timedOut = false;
        const child = spawn(argv[0], argv.slice(1), {env, stdio: ['ignore', 2, 2], cwd: REPO_ROOT});
        const timer = setTimeout(() => {
            timedOut = true;
            child.kill('SIGKILL');
        }, remainingMs);
        child.on('error', () => {
            clearTimeout(timer);
            resolve({ok: false, reason: 'command could not be started'});
        });
        child.on('close', (code) => {
            clearTimeout(timer);
            if (timedOut) {
                resolve({ok: false, timedOut: true, reason: 'command exceeded the stage time budget'});
            } else {
                resolve({ok: code === 0, reason: code === 0 ? '' : `command exited with ${code}`});
            }
        });
    });
}

function rejectResult(ctx, resultAbs, suffix, errors) {
    const rejected = path.join(ctx.dir, `agent-result${suffix}.rejected.json`);
    if (fs.existsSync(resultAbs)) {
        fs.renameSync(resultAbs, rejected);
    }
    writeCanonical(path.join(ctx.dir, `agent-result${suffix}.errors.json`), {errors});
}

/**
 * Obtains a validated agent result for the stage. Throws StageSignal(20) when a manual result is still missing,
 * StageSignal(21) when a manual result was invalid, StageSignal(22) when a command keeps failing, and BudgetExceeded
 * when a cap is reached.
 */
export async function runAgent(ctx, spec) {
    const suffix = spec.name ? `.${spec.name}` : '';
    const resultRel = `${ctx.stageDirName}/agent-result${suffix}.json`;
    const taskRel = `${ctx.stageDirName}/agent-task${suffix}.json`;
    const resultAbs = path.join(ctx.out, resultRel);
    const taskAbs = path.join(ctx.out, taskRel);

    const schemaInfo = resolveSchema(ctx, spec, suffix);
    const task = buildTask(ctx, spec, resultRel, stripUndefined(schemaInfo));
    ctx.writeJson(`agent-task${suffix}.json`, task, 'orch#agent-task');

    const provider = ctx.provider;
    const finish = (data) => {
        for (const extra of ['rejected', 'errors']) {
            fs.rmSync(path.join(ctx.dir, `agent-result${suffix}.${extra}.json`), {force: true});
        }
        return data;
    };

    const consume = (providerKind, attempt) => {
        const read = readResult(resultAbs);
        const errors = read.errors ?? checkResult(ctx, spec, task, read.data);
        if (!errors.length && ctx.hasLoggedOk(task.task_id)) {
            return {data: read.data, errors};
        }
        ctx.assertAgentCallAllowed();
        ctx.logAgentCall({
            role: spec.role,
            provider: providerKind,
            task_id: task.task_id,
            attempt,
            outcome: errors.length ? 'invalid' : 'ok',
        });
        return {data: read.data, errors};
    };

    if (fs.existsSync(resultAbs)) {
        const attempt = ctx.state.invalid_results + 1;
        const {data, errors} = consume('manual', attempt);
        if (!errors.length) {
            return finish(data);
        }
        rejectResult(ctx, resultAbs, suffix, errors);
        ctx.state.invalid_results += 1;
        ctx.state.retries_used += 1;
        if (ctx.state.retries_used > ctx.budget.retries) {
            throw new BudgetExceeded(
                'retries_exceeded',
                `agent result invalid ${ctx.state.invalid_results} times: ${errors[0]}`,
            );
        }
        throw new StageSignal(
            EXIT.AGENT_INVALID,
            'agent_invalid',
            `agent result rejected: ${errors.slice(0, 3).join('; ')}`,
            {taskAbs, resultAbs},
        );
    }

    if (provider.kind === 'manual') {
        throw new StageSignal(EXIT.AWAITING_AGENT, 'awaiting_agent', `awaiting agent result (${spec.role})`, {
            taskAbs,
            resultAbs,
        });
    }

    let lastError = '';
    let commandFailures = 0;
    for (let attempt = 1; attempt <= ctx.budget.retries + 1; attempt++) {
        ctx.assertAgentCallAllowed();
        fs.rmSync(resultAbs, {force: true});
        const done = await invoke(ctx, provider, task, taskAbs, resultAbs);
        if (!done.ok) {
            ctx.logAgentCall({
                role: spec.role,
                provider: provider.kind,
                task_id: task.task_id,
                attempt,
                outcome: done.timedOut ? 'timeout' : 'failed',
            });
            if (done.timedOut) {
                throw new BudgetExceeded('time_exceeded', 'agent command exceeded the stage time budget');
            }
            lastError = done.reason;
            commandFailures += 1;
            ctx.state.retries_used += 1;
            continue;
        }
        const read = readResult(resultAbs);
        const errors = read.errors ?? checkResult(ctx, spec, task, read.data);
        if (!errors.length) {
            ctx.logAgentCall({role: spec.role, provider: provider.kind, task_id: task.task_id, attempt, outcome: 'ok'});
            return finish(read.data);
        }
        ctx.logAgentCall({
            role: spec.role,
            provider: provider.kind,
            task_id: task.task_id,
            attempt,
            outcome: 'invalid',
        });
        rejectResult(ctx, resultAbs, suffix, errors);
        lastError = errors[0];
        ctx.state.retries_used += 1;
    }
    if (commandFailures === ctx.budget.retries + 1) {
        throw new StageSignal(EXIT.AGENT_FAILED, 'fail', `agent command failed ${commandFailures} times: ${lastError}`);
    }
    throw new BudgetExceeded(
        'retries_exceeded',
        `agent gave no valid result after ${ctx.budget.retries + 1} attempts: ${lastError}`,
    );
}
