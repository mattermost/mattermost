// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Self-test for mutation_control.mjs against a simulated server (a tiny local HTTP server inside this test).
import http from 'node:http';

import {CONTROL_EXPECTATION, assertionError, failingTest, mkReport, passingTest} from './fixtures/report_fixtures.mjs';
import {aggregateSpecStatus, fillTemplate, gate, runControl, splitCommand} from './mutation_control.mjs';

function startServer() {
    const state = {value: 'orig', restoreCalls: 0, rejectWrites: false, ignoreWrites: false, restoreBroken: false};
    const server = http.createServer((req, res) => {
        let body = '';
        req.on('data', (chunk) => {
            body += chunk;
        });
        req.on('end', () => {
            const send = (code, json) => {
                res.writeHead(code, {'content-type': 'application/json'});
                res.end(JSON.stringify(json));
            };
            if (req.method === 'GET' && req.url === '/config') {
                send(200, {value: state.value});
            } else if (req.method === 'PUT' && req.url === '/config') {
                if (state.rejectWrites) {
                    send(400, {message: 'config validation failed'});
                } else {
                    state.value = state.ignoreWrites ? state.value : JSON.parse(body).value;
                    send(200, {ok: true});
                }
            } else if (req.method === 'POST' && req.url === '/restore') {
                state.restoreCalls++;
                if (state.restoreBroken) {
                    send(500, {message: 'restore failed'});
                } else {
                    state.value = 'orig';
                    send(200, {ok: true});
                }
            } else {
                send(404, {});
            }
        });
    });
    return new Promise((resolve) => {
        server.listen(0, '127.0.0.1', () =>
            resolve({server, state, base: `http://127.0.0.1:${server.address().port}`}),
        );
    });
}

const read = (base) => ({rest: {url: `${base}/config`}});
const readOf = (base, equals) => ({read: read(base), expect: [{path: 'value', equals}]});

function planFor(base, overrides = {}) {
    return {
        id: 'ctl-1',
        control: {id: 'ctl-1', change: 'prose describing the change'},
        precondition: readOf(base, 'orig'),
        mutator: {rest: {method: 'PUT', url: `${base}/config`, body: {value: 'mutated'}}},
        mutation_readback: readOf(base, 'mutated'),
        restore: {rest: {method: 'POST', url: `${base}/restore`}},
        restore_readback: readOf(base, 'orig'),
        expectation: CONTROL_EXPECTATION,
        ...overrides,
    };
}

const goodReport = () => mkReport([failingTest(), passingTest()]);
const elsewhereReport = () =>
    mkReport([
        failingTest('PILOT-01 control target', {
            errors: [assertionError('expect(info).toBeVisible()', ['expect(locator).toBeVisible() failed'])],
        }),
        passingTest(),
    ]);

function hookReturning(report, exitCode = 1) {
    const hook = async () => {
        hook.calls++;
        return {reports: [report()], exit_code: exitCode};
    };
    hook.calls = 0;
    return hook;
}

export async function selftestChecks() {
    const checks = [];
    const check = (name, ok, detail = '') => checks.push({name: `mutation_control: ${name}`, ok, detail});
    const {server, state, base} = await startServer();
    const reset = () =>
        Object.assign(state, {
            value: 'orig',
            restoreCalls: 0,
            rejectWrites: false,
            ignoreWrites: false,
            restoreBroken: false,
        });
    try {
        let hook = hookReturning(goodReport);
        let result = await runControl(planFor(base), {runSpec: hook});
        check(
            'accepted mutation + correct failing assertion = pass',
            result.status === 'pass' && hook.calls === 1,
            JSON.stringify(result.states.map((s) => s.state)),
        );
        check(
            'pass: restore ran and the read-back shows the original state',
            state.value === 'orig' && state.restoreCalls === 1,
        );

        reset();
        state.rejectWrites = true;
        hook = hookReturning(goodReport);
        result = await runControl(planFor(base), {runSpec: hook});
        check(
            'mutation rejected (HTTP 400) = blocked',
            result.status === 'blocked' && result.blocked_reason === 'mutation_rejected',
        );
        check('blocked: the spec is not run', hook.calls === 0);
        check(
            'blocked: the reason carries the HTTP status',
            result.states.some((s) => s.state === 'mutate' && /status 400/.test(s.detail ?? '')),
        );
        check(
            'blocked: restore still ran and verified',
            state.restoreCalls === 1 && result.states.some((s) => s.state === 'verify_restore' && s.result === 'pass'),
        );

        reset();
        hook = hookReturning(elsewhereReport);
        result = await runControl(planFor(base), {runSpec: hook});
        check(
            'mutation accepted but the spec fails elsewhere = fail',
            result.status === 'fail' && result.states.some((s) => s.state === 'judge' && s.result === 'fail'),
        );
        check('fail elsewhere: restored', state.value === 'orig');

        reset();
        state.restoreBroken = true;
        hook = hookReturning(goodReport);
        result = await runControl(planFor(base), {runSpec: hook});
        check(
            'restore failure = fail even when the control failed correctly',
            result.status === 'fail' && result.states.some((s) => s.state === 'restore' && s.result === 'fail'),
        );

        reset();
        state.restoreBroken = true;
        state.rejectWrites = true;
        result = await runControl(planFor(base), {runSpec: hookReturning(goodReport)});
        check('restore failure after a blocked control = fail', result.status === 'fail');

        reset();
        state.ignoreWrites = true;
        hook = hookReturning(goodReport);
        result = await runControl(planFor(base), {runSpec: hook});
        check(
            'accepted (200) but unchanged read-back = blocked',
            result.status === 'blocked' && result.blocked_reason === 'mutation_not_applied' && hook.calls === 0,
        );

        reset();
        state.value = 'dirty';
        hook = hookReturning(goodReport);
        result = await runControl(planFor(base), {runSpec: hook});
        check(
            'precondition not met = blocked, nothing mutated, no restore call',
            result.status === 'blocked' &&
                result.blocked_reason === 'precondition_failed' &&
                state.restoreCalls === 0 &&
                hook.calls === 0,
        );

        reset();
        result = await runControl(planFor(base), {
            runSpec: hookReturning(() => mkReport([passingTest('PILOT-01 control target'), passingTest()])),
        });
        check('control did not fail (spec stayed green) = fail', result.status === 'fail');

        reset();
        result = await runControl(planFor(base), {runSpec: hookReturning(goodReport, 0)});
        check('failing report but exit code zero = fail', result.status === 'fail');

        reset();
        result = await runControl(planFor(base), {
            runSpec: async () => {
                throw new Error('runner crashed');
            },
        });
        check(
            'runner crash = blocked, restore still ran',
            result.status === 'blocked' && state.restoreCalls === 1 && state.value === 'orig',
        );

        reset();
        result = await runControl(planFor(base), {runSpec: async () => ({reports: [{not: 'a report'}], exit_code: 1})});
        check('unreadable report = blocked', result.status === 'blocked');

        reset();
        const script =
            "fetch(process.argv[1]+'/config',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({value:'mutated'})}).then((r)=>{console.log('SECRET-CANARY');process.exit(r.ok?0:1)})";
        const cmdPlan = planFor(base, {vars: {base}, mutator: {cmd: [process.execPath, '-e', script, '{base}']}});
        result = await runControl(cmdPlan, {runSpec: hookReturning(goodReport)});
        check('a cmd mutator (argv form) works and is judged like a REST one', result.status === 'pass');
        check('command output is never echoed into the result', !JSON.stringify(result).includes('SECRET-CANARY'));

        reset();
        const failingCmd = planFor(base, {mutator: {cmd: [process.execPath, '-e', 'process.exit(7)']}});
        result = await runControl(failingCmd, {runSpec: hookReturning(goodReport)});
        check(
            'a cmd mutator exiting non-zero = blocked',
            result.status === 'blocked' && result.blocked_reason === 'mutation_rejected',
        );

        reset();
        const reportedStatus = planFor(base, {
            mutator: {cmd: [process.execPath, '-e', 'console.log(JSON.stringify({status: 403}))']},
        });
        result = await runControl(reportedStatus, {runSpec: hookReturning(goodReport)});
        check('a cmd that reports a non-2xx status = blocked even with exit 0', result.status === 'blocked');

        reset();
        let outcome = await gate.run({
            plans: [planFor(base, {mutator: {rest: {method: 'PUT', url: 'http://example.invalid/config', body: {}}}})],
            runSpec: hookReturning(goodReport),
        });
        check('a non-loopback REST target is refused (blocked)', outcome.status === 'blocked');

        reset();
        outcome = await gate.run({
            plans: [planFor(base, {mutator: {cmd: [process.execPath, '-e', '0', '{missing}']}})],
            runSpec: hookReturning(goodReport),
        });
        check('an unresolved template variable is refused (blocked)', outcome.status === 'blocked');
        check('refused plan still restored nothing wrongly', state.value === 'orig');

        reset();
        outcome = await gate.run({
            plans: [planFor(base), planFor(base, {id: 'ctl-2', control: {id: 'ctl-2'}})],
            runSpec: hookReturning(goodReport),
        });
        check(
            'two passing controls = pass / spec_status pass',
            outcome.status === 'pass' && outcome.spec_status === 'pass',
        );

        reset();
        state.rejectWrites = true;
        outcome = await gate.run({plans: [planFor(base)], runSpec: hookReturning(goodReport)});
        check(
            'a blocked control makes the spec status "control blocked", never pass',
            outcome.status === 'blocked' && outcome.spec_status === 'control blocked',
        );

        reset();
        outcome = await gate.run({plans: [], runSpec: hookReturning(goodReport)});
        check(
            'no planned controls = blocked "control blocked"',
            outcome.status === 'blocked' && outcome.spec_status === 'control blocked',
        );

        reset();
        outcome = await gate.run({
            plans: [planFor(base, {control: {id: 'other-id'}})],
            runSpec: hookReturning(goodReport),
        });
        check('plan id must match the charter control id', outcome.status === 'blocked');
    } finally {
        server.close();
    }
    check(
        'aggregate: fail beats blocked',
        aggregateSpecStatus([{status: 'blocked'}, {status: 'fail'}]).spec_status === 'fail',
    );
    check(
        'aggregate: blocked beats pass',
        aggregateSpecStatus([{status: 'pass'}, {status: 'blocked'}]).spec_status === 'control blocked',
    );
    check('aggregate: all pass', aggregateSpecStatus([{status: 'pass'}]).spec_status === 'pass');
    check('aggregate: empty is control blocked', aggregateSpecStatus([]).spec_status === 'control blocked');
    check(
        'splitCommand honours quotes and escapes without a shell',
        JSON.stringify(splitCommand(String.raw`a "b c" 'd e' f\ g ""`)) ===
            JSON.stringify(['a', 'b c', 'd e', 'f g', '']),
    );
    let threw = false;
    try {
        splitCommand('a "unterminated');
    } catch {
        threw = true;
    }
    check('splitCommand rejects an unterminated quote', threw);
    check('fillTemplate leaves JSON braces alone', fillTemplate('{"a":1} {x}', {x: 'y'}) === '{"a":1} y');
    return checks;
}
