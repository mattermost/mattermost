// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable no-await-in-loop, @stylistic/wrap-regex -- Prettier owns formatting and the repo relaxes these rules for .ts/.js only; awaits in loops run in order by design */

// Drives the MCP server over stdio pipes: protocol basics, exactly five tools, a dry run through the whole pipeline
// using only the tools, refusal of invalid results, and no write outside the run directory.
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import {fileURLToPath} from 'node:url';

import {readJsonFile} from '../lib/common.mjs';
import {loadTask} from '../lib/result_check.mjs';
import {buildStubResult} from '../lib/stub.mjs';
import {assert, removeDir, tempDir} from '../lib/testing.mjs';

const SERVER = path.join(path.dirname(fileURLToPath(import.meta.url)), 'server.mjs');
const EXPECTED_TOOLS = ['pilot_gate_report', 'pilot_next_task', 'pilot_plan', 'pilot_status', 'pilot_submit_result'];

function startServer(runsRoot) {
    const child = spawn(process.execPath, [SERVER, '--runs-root', runsRoot], {stdio: ['pipe', 'pipe', 'pipe']});
    const waiting = new Map();
    const lines = readline.createInterface({input: child.stdout});
    lines.on('line', (line) => {
        const msg = JSON.parse(line);
        waiting.get(msg.id)?.(msg);
    });
    let nextId = 1;
    const request = (method, params) =>
        new Promise((resolve, reject) => {
            const id = nextId++;
            const timer = setTimeout(() => reject(new Error(`no response to ${method}`)), 240000);
            waiting.set(id, (msg) => {
                clearTimeout(timer);
                resolve(msg);
            });
            child.stdin.write(`${JSON.stringify({jsonrpc: '2.0', id, method, params})}\n`);
        });
    const call = async (name, args) => {
        const reply = await request('tools/call', {name, arguments: args});
        assert(reply.result, `tools/call ${name} returned a protocol error`);
        const text = reply.result.content[0].text;
        return {isError: Boolean(reply.result.isError), text, data: JSON.parse(text)};
    };
    return {
        child,
        request,
        call,
        notify: (method) => child.stdin.write(`${JSON.stringify({jsonrpc: '2.0', method})}\n`),
        raw: (text) => child.stdin.write(`${text}\n`),
        close: () =>
            new Promise((resolve) => {
                child.on('close', resolve);
                child.stdin.end();
            }),
    };
}

const PLAN = {run: 'r1', target: 'main', feature: 'channels.favorites'};

export function selftestChecks() {
    const scratch = [];
    const root = tempDir('pilot-agents-mcp');
    scratch.push(root);
    const runsRoot = path.join(root, 'runs');
    let server;
    const ready = () => {
        server ??= startServer(runsRoot);
        return server;
    };

    return {
        cleanup: async () => {
            if (server) {
                await server.close();
            }
            scratch.forEach(removeDir);
        },
        checks: [
            {
                id: 'd1',
                name: 'initialize, ping and an unknown method follow JSON-RPC 2.0',
                run: async () => {
                    const s = ready();
                    const init = await s.request('initialize', {protocolVersion: '2025-03-26', capabilities: {}});
                    assert(init.result.protocolVersion === '2025-03-26', 'the requested version should be echoed');
                    assert(init.result.capabilities.tools, 'tools capability');
                    s.notify('notifications/initialized');
                    const ping = await s.request('ping');
                    assert(ping.result && !ping.error, 'ping');
                    const unknown = await s.request('resources/list');
                    assert(unknown.error?.code === -32601, 'unknown method should be -32601');
                    const fallback = await s.request('initialize', {protocolVersion: '1999-01-01'});
                    assert(fallback.result.protocolVersion === '2025-06-18', 'unknown version falls back to latest');
                    s.raw('{not json');
                    const parse = await new Promise((resolve) => {
                        s.child.stdout.once('data', (d) => resolve(JSON.parse(d.toString().trim().split('\n')[0])));
                    });
                    assert(parse.error?.code === -32700, 'invalid JSON should be -32700');
                },
            },
            {
                id: 'd2',
                name: 'tools/list lists exactly the five tools, each with a closed input schema',
                run: async () => {
                    const listed = await ready().request('tools/list');
                    const names = listed.result.tools.map((t) => t.name).sort();
                    assert(JSON.stringify(names) === JSON.stringify(EXPECTED_TOOLS), `tools: ${names.join(', ')}`);
                    for (const tool of listed.result.tools) {
                        assert(tool.inputSchema.additionalProperties === false, `${tool.name}: open schema`);
                    }
                    const unknown = await ready().request('tools/call', {name: 'run_shell', arguments: {}});
                    assert(unknown.error?.code === -32602, 'an unknown tool is a protocol error');
                },
            },
            {
                id: 'd3',
                name: 'bad arguments are refused: unknown feature, target, run names, extra properties',
                run: async () => {
                    const s = ready();
                    const bad = [
                        ['pilot_plan', {...PLAN, feature: '../../x'}],
                        ['pilot_plan', {...PLAN, feature: 'no-such-feature'}],
                        ['pilot_plan', {...PLAN, target: 'live'}],
                        ['pilot_plan', {...PLAN, run: '../escape'}],
                        ['pilot_plan', {...PLAN, run: '/tmp/abs'}],
                        ['pilot_plan', {...PLAN, live: true}],
                        ['pilot_status', {run: 'a/b'}],
                        ['pilot_next_task', {}],
                    ];
                    for (const [name, args] of bad) {
                        const reply = await s.call(name, args);
                        assert(reply.isError, `${name} ${JSON.stringify(args)} should be refused`);
                    }
                    assert(!fs.existsSync(path.join(root, 'escape')), 'a refused run name must not create anything');
                },
            },
            {
                id: 'd4',
                name: 'a dry run advances through all tasks using only the tools, then reports the gates',
                run: async () => {
                    const s = ready();
                    const empty = await s.call('pilot_status', {});
                    assert(Array.isArray(empty.data.runs) && empty.data.runs.length === 0, 'no runs at the start');
                    let plan = await s.call('pilot_plan', PLAN);
                    assert(!plan.isError && plan.data.live === false, 'pilot_plan is never live');
                    assert(plan.data.exit_code === 20, `first plan should await an agent, got ${plan.data.exit_code}`);
                    const invalid = {task_id: plan.data.pending_tasks[0].task_id, proposals: []};
                    const rejected = await s.call('pilot_submit_result', {run: 'r1', result: invalid});
                    assert(rejected.isError && rejected.data.accepted === false, 'an invalid result is refused');
                    assert(
                        !fs.existsSync(path.join(runsRoot, 'r1', '4-select', 'agent-result.json')),
                        'no file written',
                    );
                    const roles = new Set();
                    for (let i = 0; i < 8 && plan.data.pending_tasks.length > 0; i++) {
                        const next = await s.call('pilot_next_task', {run: 'r1'});
                        assert(next.data.pending && next.data.role_guidance.includes('## Checklist'), 'next task');
                        roles.add(next.data.task.role);
                        const taskFile = path.join(runsRoot, 'r1', next.data.task_file);
                        const result = await buildStubResult(loadTask(taskFile), taskFile);
                        const done = await s.call('pilot_submit_result', {run: 'r1', result});
                        assert(!done.isError && done.data.accepted, `submit failed: ${done.text}`);
                        plan = await s.call('pilot_plan', PLAN);
                    }
                    assert(
                        plan.data.exit_code === 0,
                        `the dry run should finish with exit 0, got ${plan.data.exit_code}`,
                    );
                    assert(roles.size >= 4, `expected tasks for 4 roles, got ${[...roles].join(', ')}`);
                    const none = await s.call('pilot_next_task', {run: 'r1'});
                    assert(none.data.pending === false, 'no task is pending at the end');
                    const status = await s.call('pilot_status', {run: 'r1'});
                    assert(status.data.stages.length >= 9 && status.data.pending_tasks.length === 0, 'status');
                    const report = await s.call('pilot_gate_report', {run: 'r1'});
                    assert(report.data.available && report.data.charters.length === 1, 'gate report');
                    const gates = report.data.charters[0].gates;
                    assert(
                        gates.some((g) => g.result === 'blocked') && report.data.charters[0].overall !== 'pass',
                        'a dry run cannot pass: live-only gates stay blocked',
                    );
                },
            },
            {
                id: 'd5',
                name: 'a stale or foreign result and a result with a forbidden field are refused',
                run: async () => {
                    const s = ready();
                    const dir = path.join(runsRoot, 'r2');
                    const plan = await s.call('pilot_plan', {...PLAN, run: 'r2'});
                    const taskId = plan.data.pending_tasks[0].task_id;
                    const taskFile = path.join(dir, '4-select', 'agent-task.json');
                    const stub = await buildStubResult(loadTask(taskFile), taskFile);
                    const foreign = await s.call('pilot_submit_result', {
                        run: 'r2',
                        result: {...stub, task_id: `${taskId}x`},
                    });
                    assert(foreign.isError, 'a foreign task_id is refused');
                    const route = await s.call('pilot_submit_result', {run: 'r2', result: {...stub, route_hint: 'x'}});
                    assert(route.isError && /forbidden field name/.test(route.text), 'a route field is refused');
                    const approver = await s.call('pilot_submit_result', {run: 'r2', result: {...stub, approver: 'x'}});
                    assert(approver.isError && /approval/.test(approver.text), 'an approval field is refused');
                    assert(!fs.existsSync(path.join(dir, '4-select', 'agent-result.json')), 'nothing may be written');
                },
            },
            {
                id: 'd6',
                name: 'no tool can write outside the run directory (task path, links, run names)',
                run: async () => {
                    const s = ready();
                    const dir = path.join(runsRoot, 'r3');
                    const plan = await s.call('pilot_plan', {...PLAN, run: 'r3'});
                    assert(plan.data.pending_tasks.length === 1, 'a pending task for r3');
                    const taskFile = path.join(dir, '4-select', 'agent-task.json');
                    const stub = await buildStubResult(loadTask(taskFile), taskFile);
                    const task = readJsonFile(taskFile);
                    task.output.result_file = '../../escape.json';
                    fs.writeFileSync(taskFile, JSON.stringify(task));
                    const escape = await s.call('pilot_submit_result', {run: 'r3', result: stub});
                    assert(escape.isError, 'a task that names a result outside the run is refused');
                    for (const where of [runsRoot, root, path.dirname(root)]) {
                        assert(!fs.existsSync(path.join(where, 'escape.json')), `escape.json appeared in ${where}`);
                    }
                    const outside = path.join(root, 'outside-run');
                    fs.mkdirSync(path.join(outside, '4-select'), {recursive: true});
                    fs.symlinkSync(outside, path.join(runsRoot, 'linked'));
                    const linked = await s.call('pilot_status', {run: 'linked'});
                    assert(linked.isError, 'a run directory that is a link is refused');
                    const linkedPlan = await s.call('pilot_plan', {...PLAN, run: 'linked'});
                    assert(linkedPlan.isError, 'planning into a link is refused');
                    assert(fs.readdirSync(outside).join() === '4-select', 'nothing may be written through a link');
                    assert(fs.readdirSync(path.join(outside, '4-select')).length === 0, 'link target stays empty');
                },
            },
            {
                id: 'd7',
                name: 'the server source has no Docker, shell, live-run or free-form write capability',
                run: async () => {
                    const source = fs.readFileSync(SERVER, 'utf8');
                    const banned = [
                        ['docker', /docker/i],
                        ['a shell option', /shell\s*:/],
                        ['another process API', /\b(?:execSync|execFile|execFileSync|fork|spawnSync)\b/],
                        ['a live flag', new RegExp(`--${'li'}ve\\b`)],
                        ['an arbitrary writeFile', /writeFile(?:Sync)?\s*\(/],
                        ['a network module', /node:(?:net|http|https|dgram|tls)\b/],
                    ];
                    for (const [what, re] of banned) {
                        assert(!re.test(source), `server.mjs must not contain ${what}`);
                    }
                    assert(
                        /import \{spawn\} from 'node:child_process'/.test(source),
                        'child_process may only provide spawn',
                    );
                    const spawns = source.match(/\bspawn\(/g) ?? [];
                    assert(spawns.length === 1, 'exactly one spawn, for the orchestrator dry run');
                },
            },
        ],
    };
}
