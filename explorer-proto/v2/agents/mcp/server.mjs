#!/usr/bin/env node
// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable no-process-env, @stylistic/dot-location, @stylistic/indent, no-await-in-loop -- the runs root can be set from the environment; MM_LICENSE is removed from children */

// A thin, bounded MCP server over stdio for the pilot v2 orchestrator. HAND-ROLLED SUBSET of MCP: newline-delimited
// JSON-RPC 2.0 with `initialize`, `notifications/initialized`, `ping`, `tools/list` and `tools/call` only. No SDK is
// installed in this repository, so none is used. Five tools, none of which starts a live stack, runs container
// tooling or a command line, or writes outside one run directory:
//   pilot_status, pilot_plan (dry run), pilot_next_task, pilot_submit_result, pilot_gate_report.
//
// node server.mjs [--runs-root <dir>]      default: explorer-proto/v2/orchestrator/.runs (git-ignored)
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import {fileURLToPath} from 'node:url';

import {ORCH_DIR, PILOT_CLI, readJsonFile, realInside, REPO_ROOT, ROLES_DIR} from '../lib/common.mjs';
import {deniedInputs, roleEntryFor} from '../lib/prompt.mjs';
import {checkResult, loadTask, outDirOf, staleReasons, writeResult} from '../lib/result_check.mjs';

export const SUPPORTED_PROTOCOLS = ['2025-06-18', '2025-03-26', '2024-11-05'];
const SERVER_INFO = {name: 'explorer-pilot-v2', version: '0.1.0'};
const RUN_NAME = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/;
const FEATURE_ID = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/;
const STAGE_DIR = /^(\d+)-([a-z]+)$/;
const TASK_FILE = /^agent-task(?:\.[a-z0-9-]+)?\.json$/;
const MAX_MESSAGE_BYTES = 2 * 1024 * 1024;
const MAX_TEXT = 100000;
const PLAN_TIMEOUT_MS = 180000;
const EXIT_MEANING = {
    0: 'every stage in range is pass or skipped',
    1: 'a stage failed',
    2: 'usage error',
    3: 'blocked: a precondition is missing',
    20: 'awaiting an agent result: call pilot_next_task',
    21: 'an agent result was invalid or stale and was set aside',
    22: 'the agent command failed',
};

const RUN_PROP = {
    type: 'string',
    pattern: RUN_NAME.source,
    description: 'Run name: a directory below the runs root. Letters, digits, dot, dash, underscore.',
};

export const TOOLS = [
    {
        name: 'pilot_status',
        description:
            'Read-only. Without `run`, list the runs. With `run`, show the run configuration, each stage record and the pending agent tasks.',
        inputSchema: {type: 'object', additionalProperties: false, properties: {run: RUN_PROP}},
        annotations: {readOnlyHint: true, openWorldHint: false},
    },
    {
        name: 'pilot_plan',
        description:
            'Dry run only, never live: runs the orchestrator with --dry-run and --agents=manual into the run directory (no container, no stack). Call it again after pilot_submit_result to advance the run.',
        inputSchema: {
            type: 'object',
            additionalProperties: false,
            required: ['run', 'target', 'feature'],
            properties: {
                run: RUN_PROP,
                target: {enum: ['release', 'main']},
                feature: {type: 'string', pattern: FEATURE_ID.source, description: 'A feature id from features/.'},
                mode: {enum: ['explore', 'author', 'both']},
            },
        },
        annotations: {readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false},
    },
    {
        name: 'pilot_next_task',
        description:
            'Read-only. Return the first pending agent-task.json of the run with the role guidance for its role, or say that none is pending.',
        inputSchema: {type: 'object', additionalProperties: false, required: ['run'], properties: {run: RUN_PROP}},
        annotations: {readOnlyHint: true, openWorldHint: false},
    },
    {
        name: 'pilot_submit_result',
        description:
            "Validate an agent result against the pending task and, only if it is valid, write it as that task's agent-result file inside the run directory. A result with a forbidden field, unsafe text, licence-like text or the wrong task_id is refused.",
        inputSchema: {
            type: 'object',
            additionalProperties: false,
            required: ['run', 'result'],
            properties: {run: RUN_PROP, result: {type: 'object', description: 'The result JSON object.'}},
        },
        annotations: {readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false},
    },
    {
        name: 'pilot_gate_report',
        description:
            'Read-only. Summarise the deterministic gate results and verdicts of stage 7 for each charter. Gate results are final; agent results cannot change them.',
        inputSchema: {type: 'object', additionalProperties: false, required: ['run'], properties: {run: RUN_PROP}},
        annotations: {readOnlyHint: true, openWorldHint: false},
    },
];

class ToolError extends Error {}

function runsRootFrom(argv) {
    const i = argv.indexOf('--runs-root');
    if (i >= 0 && argv[i + 1]) {
        return path.resolve(argv[i + 1]);
    }
    return path.resolve(process.env.PILOT_MCP_RUNS_ROOT ?? path.join(ORCH_DIR, '.runs'));
}

function validateArgs(schema, args) {
    const errors = [];
    if (!args || typeof args !== 'object' || Array.isArray(args)) {
        return ['arguments must be an object'];
    }
    for (const key of schema.required ?? []) {
        if (!(key in args)) {
            errors.push(`${key} is required`);
        }
    }
    for (const [key, value] of Object.entries(args)) {
        const def = schema.properties[key];
        if (!def) {
            errors.push(`${key} is not a known argument`);
        } else if (def.enum && !def.enum.includes(value)) {
            errors.push(`${key} must be one of ${def.enum.join(', ')}`);
        } else if (
            def.type === 'string' &&
            (typeof value !== 'string' || (def.pattern && !new RegExp(def.pattern).test(value)))
        ) {
            errors.push(`${key} is not a valid ${def.pattern ? 'name' : 'string'}`);
        } else if (def.type === 'object' && (!value || typeof value !== 'object' || Array.isArray(value))) {
            errors.push(`${key} must be an object`);
        }
    }
    return errors;
}

function textResult(value, isError = false) {
    let text = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
    if (text.length > MAX_TEXT) {
        text = `${text.slice(0, MAX_TEXT)}\n... truncated`;
    }
    return {content: [{type: 'text', text}], ...(isError ? {isError: true} : {})};
}

function ensureRunsRoot(ctx) {
    fs.mkdirSync(ctx.runsRoot, {recursive: true});
    return fs.realpathSync(ctx.runsRoot);
}

/** Resolves a run name to a directory below the runs root. Refuses links and anything that leaves the root. */
function resolveRun(ctx, name, {mustExist}) {
    if (typeof name !== 'string' || !RUN_NAME.test(name) || name.includes('..')) {
        throw new ToolError('run is not a valid run name');
    }
    const root = ensureRunsRoot(ctx);
    const dir = path.join(root, name);
    if (fs.existsSync(dir)) {
        if (fs.lstatSync(dir).isSymbolicLink() || !fs.statSync(dir).isDirectory() || !realInside(root, dir)) {
            throw new ToolError('the run directory is not a plain directory inside the runs root');
        }
    } else if (mustExist) {
        throw new ToolError('no such run');
    }
    return dir;
}

function stageDirs(runDir) {
    if (!fs.existsSync(runDir)) {
        return [];
    }
    return fs
        .readdirSync(runDir)
        .map((name) => ({name, match: STAGE_DIR.exec(name)}))
        .filter((e) => e.match && fs.statSync(path.join(runDir, e.name)).isDirectory())
        .sort((a, b) => Number(a.match[1]) - Number(b.match[1]))
        .map((e) => e.name);
}

function listTasks(runDir) {
    const tasks = [];
    for (const dirName of stageDirs(runDir)) {
        for (const file of fs.readdirSync(path.join(runDir, dirName)).sort()) {
            if (!TASK_FILE.test(file)) {
                continue;
            }
            const taskFile = path.join(runDir, dirName, file);
            let task;
            try {
                task = readJsonFile(taskFile);
            } catch {
                continue;
            }
            const resultFile = path.join(runDir, dirName, file.replace(/^agent-task/, 'agent-result'));
            tasks.push({
                taskFile,
                resultFile,
                task,
                pending: !fs.existsSync(resultFile),
                rel: `${dirName}/${file}`,
            });
        }
    }
    return tasks;
}

function summarizeTask(t) {
    return {
        task_id: t.task.task_id,
        stage: t.task.stage,
        role: t.task.role,
        task_file: t.rel,
        result_file: t.task.output?.result_file,
        pending: t.pending,
    };
}

function toolStatus(ctx, args) {
    if (!args.run) {
        const root = ensureRunsRoot(ctx);
        const runs = fs
            .readdirSync(root)
            .filter((n) => RUN_NAME.test(n))
            .map((n) => ({name: n, file: path.join(root, n, 'run.json')}))
            .filter((r) => fs.existsSync(r.file) && !fs.lstatSync(path.join(root, r.name)).isSymbolicLink())
            .map((r) => ({run: r.name, config: readJsonFile(r.file)}));
        return {runs};
    }
    const runDir = resolveRun(ctx, args.run, {mustExist: true});
    const runFile = path.join(runDir, 'run.json');
    const stages = stageDirs(runDir)
        .map((d) => path.join(runDir, d, 'stage-record.json'))
        .filter((f) => fs.existsSync(f))
        .map((f) => {
            const rec = readJsonFile(f);
            return {
                stage: rec.metrics?.stage,
                result: rec.result,
                reason: rec.reason,
                exit_code: rec.metrics?.exit_code,
                budget_outcome: rec.budget_outcome,
                agent_calls: rec.metrics?.agent_calls,
            };
        });
    const pending = listTasks(runDir)
        .filter((t) => t.pending)
        .map(summarizeTask);
    return {
        run: args.run,
        config: fs.existsSync(runFile) ? readJsonFile(runFile) : null,
        stages,
        pending_tasks: pending,
        next: pending.length > 0 ? 'call pilot_next_task' : 'call pilot_plan to advance, or see pilot_gate_report',
    };
}

function spawnPilot(argv) {
    return new Promise((resolve) => {
        const env = {...process.env};
        delete env.MM_LICENSE;
        let stdout = '';
        const child = spawn(process.execPath, [PILOT_CLI, ...argv], {
            cwd: REPO_ROOT,
            env,
            stdio: ['ignore', 'pipe', 'ignore'],
        });
        const timer = setTimeout(() => child.kill('SIGKILL'), PLAN_TIMEOUT_MS);
        child.stdout.on('data', (d) => {
            stdout = (stdout + d.toString('utf8')).slice(-8000);
        });
        child.on('error', () => {
            clearTimeout(timer);
            resolve({code: -1, stdout});
        });
        child.on('close', (code) => {
            clearTimeout(timer);
            resolve({code, stdout});
        });
    });
}

async function toolPlan(ctx, args) {
    const features = fs
        .readdirSync(path.join(ORCH_DIR, 'features'))
        .filter((f) => f.endsWith('.json'))
        .map((f) => f.replace(/\.json$/, ''));
    if (!features.includes(args.feature)) {
        throw new ToolError(`unknown feature; known: ${features.join(', ')}`);
    }
    const runDir = resolveRun(ctx, args.run, {mustExist: false});
    const argv = [
        'run',
        '--target',
        args.target,
        '--feature',
        args.feature,
        '--mode',
        args.mode ?? 'both',
        '--dry-run',
        '--agents=manual',
        '--out',
        runDir,
    ];
    const {code, stdout} = await spawnPilot(argv);
    return {
        exit_code: code,
        meaning: EXIT_MEANING[code] ?? 'unexpected exit code',
        live: false,
        stage_table: stdout.trim(),
        pending_tasks: listTasks(runDir)
            .filter((t) => t.pending)
            .map(summarizeTask),
    };
}

function toolNextTask(ctx, args) {
    const runDir = resolveRun(ctx, args.run, {mustExist: true});
    const next = listTasks(runDir).find((t) => t.pending);
    if (!next) {
        return {pending: false, hint: 'no pending task: call pilot_plan to advance the run, or the run is complete'};
    }
    const roleEntry = roleEntryFor(next.task);
    const taskFile = next.taskFile;
    loadTask(taskFile);
    const stale = staleReasons(next.task, taskFile);
    if (stale.length > 0) {
        throw new ToolError(`the task is stale (${stale.join('; ')}); call pilot_plan to regenerate it`);
    }
    const denied = deniedInputs(next.task, roleEntry);
    if (denied.length > 0) {
        throw new ToolError(`inputs the ${roleEntry.id} role must not see: ${denied.map((d) => d.path).join(', ')}`);
    }
    const errorsFile = next.resultFile.replace(/\.json$/, '.errors.json');
    return {
        pending: true,
        task: next.task,
        task_file: next.rel,
        role_file: `explorer-proto/v2/agents/roles/${roleEntry.file}`,
        role_guidance: fs.readFileSync(path.join(ROLES_DIR, roleEntry.file), 'utf8'),
        previous_errors: fs.existsSync(errorsFile) ? readJsonFile(errorsFile).errors : [],
        reply_with: 'pilot_submit_result {run, result}',
    };
}

function toolSubmit(ctx, args) {
    const runDir = resolveRun(ctx, args.run, {mustExist: true});
    const data = args.result;
    if (JSON.stringify(data).length > MAX_MESSAGE_BYTES) {
        throw new ToolError('the result is too large');
    }
    const match = listTasks(runDir).find((t) => t.pending && t.task.task_id === data.task_id);
    if (!match) {
        throw new ToolError('no pending task has this task_id (stale or foreign result)');
    }
    const task = loadTask(match.taskFile);
    const stale = staleReasons(task, match.taskFile);
    if (stale.length > 0) {
        throw new ToolError(`the task is stale (${stale.join('; ')}); call pilot_plan to regenerate it`);
    }
    const roleEntry = roleEntryFor(task);
    const verdict = checkResult(task, match.taskFile, data, roleEntry);
    if (!verdict.ok) {
        return textResult({accepted: false, errors: verdict.errors}, true);
    }
    const target = writeResult(task, match.taskFile, data);
    return {
        accepted: true,
        result_file: path.relative(outDirOf(match.taskFile), target).split(path.sep).join('/'),
        next: 'call pilot_plan with the same arguments to continue the dry run',
    };
}

function toolGateReport(ctx, args) {
    const runDir = resolveRun(ctx, args.run, {mustExist: true});
    const verifyDir = stageDirs(runDir).find((d) => d.endsWith('-verify'));
    const summaryFile = verifyDir && path.join(runDir, verifyDir, 'verify-summary.json');
    if (!summaryFile || !fs.existsSync(summaryFile)) {
        return {available: false, reason: 'the verify stage has not produced gate results for this run yet'};
    }
    const summary = readJsonFile(summaryFile);
    const charters = summary.verdicts.map((v) => {
        const gateFile = path.join(
            runDir,
            verifyDir,
            'gates',
            `${path.basename(v.file).replace(/\.verdict\.json$/, '')}.json`,
        );
        const gates = fs.existsSync(gateFile) ? readJsonFile(gateFile).gates : [];
        return {
            charter_id: v.charter_id,
            overall: v.overall,
            outcome: v.outcome,
            gates: gates.map((g) => ({
                gate: g.gate,
                result: g.result,
                ...(g.blocked_reason ? {blocked_reason: g.blocked_reason} : {}),
                evidence: g.evidence.map((e) => `${e.kind}:${e.ref}`),
            })),
        };
    });
    return {
        available: true,
        live: summary.live,
        gates_run: summary.gates,
        charters,
        note: 'deterministic gate results are final; agent results can only add a failure',
    };
}

const HANDLERS = {
    pilot_status: toolStatus,
    pilot_plan: toolPlan,
    pilot_next_task: toolNextTask,
    pilot_submit_result: toolSubmit,
    pilot_gate_report: toolGateReport,
};

export async function callTool(ctx, name, args) {
    const tool = TOOLS.find((t) => t.name === name);
    if (!tool) {
        return null;
    }
    const problems = validateArgs(tool.inputSchema, args ?? {});
    if (problems.length > 0) {
        return textResult({error: problems}, true);
    }
    try {
        const out = await HANDLERS[name](ctx, args ?? {});
        return out?.content ? out : textResult(out);
    } catch (e) {
        return textResult({error: e instanceof ToolError ? e.message : `refused: ${e.message}`}, true);
    }
}

const RPC = {PARSE: -32700, INVALID_REQUEST: -32600, METHOD_NOT_FOUND: -32601, INVALID_PARAMS: -32602};

function rpcError(id, code, message) {
    return {jsonrpc: '2.0', id: id ?? null, error: {code, message}};
}

/** Handles one JSON-RPC message; returns the response object, or null for a notification. */
export async function handleMessage(ctx, msg) {
    if (!msg || typeof msg !== 'object' || msg.jsonrpc !== '2.0' || typeof msg.method !== 'string') {
        return rpcError(msg?.id, RPC.INVALID_REQUEST, 'not a JSON-RPC 2.0 request');
    }
    const isNotification = !('id' in msg);
    const reply = (result) => (isNotification ? null : {jsonrpc: '2.0', id: msg.id, result});
    switch (msg.method) {
        case 'initialize': {
            const asked = msg.params?.protocolVersion;
            return reply({
                protocolVersion: SUPPORTED_PROTOCOLS.includes(asked) ? asked : SUPPORTED_PROTOCOLS[0],
                capabilities: {tools: {listChanged: false}},
                serverInfo: SERVER_INFO,
                instructions:
                    'Pilot v2 orchestrator wrapper. Dry runs only. Agent results are advisory and cannot override a gate.',
            });
        }
        case 'ping':
            return reply({});
        case 'tools/list':
            return reply({tools: TOOLS});
        case 'tools/call': {
            const name = msg.params?.name;
            const out = await callTool(ctx, name, msg.params?.arguments);
            if (out === null) {
                return isNotification ? null : rpcError(msg.id, RPC.INVALID_PARAMS, `unknown tool ${String(name)}`);
            }
            return reply(out);
        }
        default:
            if (msg.method.startsWith('notifications/') || isNotification) {
                return null;
            }
            return rpcError(msg.id, RPC.METHOD_NOT_FOUND, `method not found: ${msg.method}`);
    }
}

export function serve({input, output, runsRoot}) {
    const ctx = {runsRoot};
    const rl = readline.createInterface({input, crlfDelay: Infinity});
    let chain = Promise.resolve();
    const send = (obj) => {
        if (obj) {
            output.write(`${JSON.stringify(obj)}\n`);
        }
    };
    rl.on('line', (line) => {
        if (!line.trim()) {
            return;
        }
        chain = chain.then(async () => {
            if (Buffer.byteLength(line) > MAX_MESSAGE_BYTES) {
                send(rpcError(null, RPC.INVALID_REQUEST, 'message too large'));
                return;
            }
            let parsed;
            try {
                parsed = JSON.parse(line);
            } catch {
                send(rpcError(null, RPC.PARSE, 'parse error'));
                return;
            }
            const batch = Array.isArray(parsed);
            const responses = [];
            for (const msg of batch ? parsed : [parsed]) {
                responses.push(await handleMessage(ctx, msg));
            }
            const answered = responses.filter(Boolean);
            if (batch) {
                send(answered.length > 0 ? answered : null);
            } else {
                send(answered[0]);
            }
        });
    });
    return new Promise((resolve) => rl.on('close', () => chain.then(resolve)));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    serve({input: process.stdin, output: process.stdout, runsRoot: runsRootFrom(process.argv.slice(2))}).then(() => {
        process.exitCode = 0;
    });
}
