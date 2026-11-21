#!/usr/bin/env node
// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Gate `mutation_control`: runner-agnostic executor of one negative-control plan.
//
// States, in order (a plan that stops early still reports every state it reached):
//   precondition   a declared read must show the expected starting state
//   mutate         the caller's mutator command or REST call; non-2xx or non-zero exit => BLOCKED (lesson 4)
//   verify_mutation  a read-back must show the mutation took effect; unchanged => BLOCKED
//   run_spec       left to the caller (hook, or the plan's run_spec command)
//   judge          replay_judge in control-fail mode; the named assertion must be the only failure
//   restore        ALWAYS runs once the mutator was invoked; failure => FAIL
//   verify_restore a read-back must show the original state; mismatch => FAIL
//
// Commands are caller supplied `cmd:` templates ("{name}" is filled from plan.vars) run WITHOUT a shell.
// Evidence holds state names, HTTP status codes and rule ids only: command output is never echoed.
//
// Interface: gate.run({plans: [plan|path], runSpec}) -> {status, evidence, spec_status}; runControl(plan, {runSpec}).
// CLI: mutation_control.mjs <plan.json>...   (plan.run_spec.cmd must write the Playwright JSON report named in plan.reports)
import {spawn} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

import {
    UsageError,
    exitCodeFor,
    guardedAsync,
    parseArgs,
    printJson,
    readJsonFile,
    runCli,
    worstStatus,
} from './common.mjs';
import {judge} from './replay_judge.mjs';

const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]']);
const REQUEST_TIMEOUT_MS = 15000;
const COMMAND_TIMEOUT_MS = 120000;
const MAX_OUTPUT = 1 << 20;

export function fillTemplate(template, vars = {}) {
    return String(template).replace(/\{([a-z_][a-z0-9_]*)\}/g, (_, name) => {
        if (typeof vars[name] !== 'string' && typeof vars[name] !== 'number') {
            throw new UsageError(`unresolved template variable ${name}`);
        }
        return String(vars[name]);
    });
}

// Splits a command string into argv: single and double quotes and backslash escapes only; no expansion.
export function splitCommand(text) {
    const argv = [];
    let current = '';
    let quote = null;
    let inToken = false;
    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (quote) {
            if (ch === quote) {
                quote = null;
            } else if (ch === '\\' && quote === '"' && i + 1 < text.length) {
                current += text[++i];
            } else {
                current += ch;
            }
        } else if (ch === '"' || ch === "'") {
            quote = ch;
            inToken = true;
        } else if (/\s/.test(ch)) {
            if (inToken) {
                argv.push(current);
                current = '';
                inToken = false;
            }
        } else if (ch === '\\' && i + 1 < text.length) {
            current += text[++i];
            inToken = true;
        } else {
            current += ch;
            inToken = true;
        }
    }
    if (quote) {
        throw new UsageError('unterminated quote in cmd template');
    }
    if (inToken) {
        argv.push(current);
    }
    return argv;
}

function parseJson(text) {
    try {
        return JSON.parse(text);
    } catch {
        return undefined;
    }
}

async function runRest(rest, vars) {
    const url = new URL(fillTemplate(rest.url, vars));
    if (!LOOPBACK_HOSTS.has(url.hostname)) {
        throw new UsageError('REST actions may only target a loopback host');
    }
    const headers = {'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest'};
    for (const [key, value] of Object.entries(rest.headers ?? {})) {
        headers[key] = fillTemplate(value, vars);
    }
    if (rest.auth_env) {
        const secret = process.env[rest.auth_env];
        if (!secret) {
            throw new UsageError(`environment variable ${rest.auth_env} is not set`);
        }
        headers.Authorization = `Bearer ${secret}`;
    }
    let response;
    try {
        response = await fetch(url, {
            method: rest.method ?? 'GET',
            headers,
            body: rest.body === undefined ? undefined : fillTemplate(JSON.stringify(rest.body), vars),
            signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
    } catch {
        return {ok: false, status: 0, json: undefined, reason: 'request_failed'};
    }
    const json = parseJson(await response.text());
    return {ok: response.ok, status: response.status, json, reason: response.ok ? 'ok' : 'non_2xx'};
}

function runCmd(cmd, vars) {
    const argv = Array.isArray(cmd) ? cmd.map((a) => fillTemplate(a, vars)) : splitCommand(fillTemplate(cmd, vars));
    if (argv.length === 0) {
        throw new UsageError('empty cmd template');
    }
    return new Promise((resolve) => {
        const child = spawn(argv[0], argv.slice(1), {shell: false, stdio: ['ignore', 'pipe', 'ignore']});
        const timer = setTimeout(() => child.kill('SIGKILL'), COMMAND_TIMEOUT_MS);
        let stdout = '';
        child.stdout.on('data', (chunk) => {
            if (stdout.length < MAX_OUTPUT) {
                stdout += chunk;
            }
        });
        child.on('error', () => {
            clearTimeout(timer);
            resolve({ok: false, status: 0, json: undefined, reason: 'command_failed'});
        });
        child.on('close', (code) => {
            clearTimeout(timer);
            const json = parseJson(stdout);
            const reported = json?.status ?? json?.http_status;
            const httpOk = typeof reported !== 'number' || (reported >= 200 && reported < 300);
            const ok = code === 0 && httpOk;
            resolve({
                ok,
                status: typeof reported === 'number' ? reported : (code ?? 1),
                json,
                reason: ok ? 'ok' : 'command_rejected',
            });
        });
    });
}

export async function runAction(action, vars) {
    if (action?.rest) {
        return runRest(action.rest, vars);
    }
    if (action?.cmd !== undefined) {
        return runCmd(action.cmd, vars);
    }
    throw new UsageError('an action needs rest or cmd');
}

function valueAt(json, dotted) {
    return dotted.split('.').reduce((o, k) => (o === null || o === undefined ? undefined : o[k]), json);
}

// expect: [{path, equals}] or [{path, not_equals}]; all must hold.
export function expectationHolds(json, expect) {
    if (!Array.isArray(expect) || expect.length === 0) {
        throw new UsageError('a read needs a non-empty expect list');
    }
    return expect.every((rule) => {
        const actual = valueAt(json, rule.path);
        if ('equals' in rule) {
            return JSON.stringify(actual) === JSON.stringify(rule.equals);
        }
        if ('not_equals' in rule) {
            return JSON.stringify(actual) !== JSON.stringify(rule.not_equals);
        }
        throw new UsageError('an expect rule needs equals or not_equals');
    });
}

async function readAndCheck(read, vars) {
    const result = await runAction(read.read, vars);
    if (!result.ok) {
        return {ok: false, detail: `read failed (${result.reason}, status ${result.status})`};
    }
    return {ok: expectationHolds(result.json, read.expect), detail: 'read-back compared'};
}

function validatePlan(plan) {
    for (const key of [
        'id',
        'precondition',
        'mutator',
        'mutation_readback',
        'restore',
        'restore_readback',
        'expectation',
    ]) {
        if (plan?.[key] === undefined) {
            throw new UsageError(`plan is missing ${key}`);
        }
    }
    if (plan.expectation.mode !== 'control-fail') {
        throw new UsageError('plan.expectation.mode must be control-fail');
    }
    if (plan.control?.id !== undefined && plan.control.id !== plan.id) {
        throw new UsageError('plan.id does not match the charter negative_controls entry id');
    }
}

export async function runControl(plan, hooks = {}) {
    validatePlan(plan);
    const vars = plan.vars ?? {};
    const states = [];
    const record = (state, result, detail) => states.push({state, result, ...(detail ? {detail} : {})});
    let spec = 'pass';
    let restoreFailed = false;
    let blockedReason;
    let mutatorInvoked = false;

    const finish = () => {
        let status;
        if (restoreFailed || spec === 'fail') {
            status = 'fail';
        } else {
            status = blockedReason || spec === 'blocked' ? 'blocked' : 'pass';
        }
        return {id: plan.id, status, ...(blockedReason ? {blocked_reason: blockedReason} : {}), states};
    };

    const pre = await readAndCheck(plan.precondition, vars);
    record('precondition', pre.ok ? 'pass' : 'blocked', pre.ok ? undefined : pre.detail);
    if (!pre.ok) {
        blockedReason = 'precondition_failed';
        return finish();
    }

    try {
        mutatorInvoked = true;
        const mutation = await runAction(plan.mutator, vars);
        if (mutation.ok) {
            record('mutate', 'pass', `status ${mutation.status}`);
            const applied = await readAndCheck(plan.mutation_readback, vars);
            record(
                'verify_mutation',
                applied.ok ? 'pass' : 'blocked',
                applied.ok ? undefined : 'read-back does not show the mutation',
            );
            if (!applied.ok) {
                blockedReason = 'mutation_not_applied';
            }
        } else {
            record('mutate', 'blocked', `mutation rejected (${mutation.reason}, status ${mutation.status})`);
            blockedReason = 'mutation_rejected';
        }
        if (!blockedReason) {
            spec = await runAndJudge(plan, hooks, record);
        }
    } finally {
        if (mutatorInvoked) {
            restoreFailed = (await restoreAndVerify(plan, vars, record)) === false;
        }
    }
    return finish();
}

async function runAndJudge(plan, hooks, record) {
    let outcome;
    try {
        if (hooks.runSpec) {
            outcome = await hooks.runSpec({control_id: plan.id, vars: plan.vars ?? {}});
        } else if (plan.run_spec?.cmd === undefined) {
            throw new UsageError('no runSpec hook and no plan.run_spec');
        } else {
            const run = await runCmd(plan.run_spec.cmd, plan.vars ?? {});
            outcome = {
                reports: (plan.reports ?? []).map((r) => fillTemplate(r, plan.vars ?? {})),
                exit_code: run.status,
            };
        }
    } catch {
        record('run_spec', 'blocked', 'the spec could not be run');
        return 'blocked';
    }
    record(
        'run_spec',
        'pass',
        outcome.exit_code === undefined ? undefined : `exit ${outcome.exit_code === 0 ? 'zero' : 'non-zero'}`,
    );
    const verdict = judge({reports: outcome.reports, expectation: plan.expectation});
    if (verdict.status !== 'pass') {
        record('judge', verdict.status, verdict.evidence.map((e) => e.rule).join(','));
        return verdict.status;
    }
    if (outcome.exit_code === 0) {
        record('judge', 'fail', 'report shows a failing control but the run exited zero');
        return 'fail';
    }
    record('judge', 'pass', `failed only at the named assertion (${verdict.observed})`);
    return 'pass';
}

async function restoreAndVerify(plan, vars, record) {
    try {
        const restored = await runAction(plan.restore, vars);
        if (!restored.ok) {
            record('restore', 'fail', `restore rejected (${restored.reason}, status ${restored.status})`);
            return false;
        }
        record('restore', 'pass', `status ${restored.status}`);
        const check = await readAndCheck(plan.restore_readback, vars);
        record(
            'verify_restore',
            check.ok ? 'pass' : 'fail',
            check.ok ? undefined : 'read-back does not show the original state',
        );
        return check.ok;
    } catch {
        record('restore', 'fail', 'restore could not run');
        return false;
    }
}

// A blocked control never reads as pass: the spec is "control blocked". No planned control is also blocked.
export function aggregateSpecStatus(results) {
    if (!Array.isArray(results) || results.length === 0) {
        return {spec_status: 'control blocked', reason: 'no_controls_planned'};
    }
    const status = worstStatus(...results.map((r) => r.status));
    if (status === 'fail') {
        return {spec_status: 'fail', reason: 'control_failed'};
    }
    return status === 'blocked'
        ? {spec_status: 'control blocked', reason: 'control_blocked'}
        : {spec_status: 'pass', reason: 'all_controls_passed'};
}

export const gate = {
    id: 'mutation_control',
    run(ctx = {}) {
        return guardedAsync(async () => {
            const plans = (ctx.plans ?? []).map((p) => (typeof p === 'string' ? readJsonFile(p) : p));
            const results = [];
            for (const plan of plans) {
                results.push(await runControl(plan, {runSpec: ctx.runSpec}));
            }
            const aggregate = aggregateSpecStatus(results);
            const status = results.length === 0 ? 'blocked' : worstStatus(...results.map((r) => r.status));
            const evidence = results.map((r) => ({
                rule: 'control',
                id: r.id,
                result: r.status,
                ...(r.blocked_reason ? {reason: r.blocked_reason} : {}),
                states: r.states,
            }));
            if (results.length === 0) {
                evidence.push({rule: 'control', result: 'blocked', reason: 'no_controls_planned'});
            }
            return {status, evidence, ...aggregate};
        });
    },
};

async function main() {
    const {positional} = parseArgs(process.argv.slice(2));
    if (positional.length === 0) {
        throw new UsageError('usage: mutation_control.mjs <plan.json>...');
    }
    const result = await gate.run({plans: positional});
    printJson(result);
    return exitCodeFor(result.status);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    runCli(main);
}
