// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable @stylistic/indent, @stylistic/multiline-ternary, @stylistic/operator-linebreak -- Prettier owns formatting and the repo config relaxes these rules for .ts/.js only */

// S4, collect: validates the independent verifier's result (verify/agent-result.json) against the schema and the
// orchestrator's own records, then writes the run summary. A result that contradicts the records is set aside (exit 21);
// a spec hash mismatch fails the run. After a process delivery (dispatch.json carries a `delivery` record) the result
// must also carry a receipt bound to that dispatch; a missing, stale, unbound or contradicting result leaves the run
// `incomplete` (exit 30), never pass and never fail.
import fs from 'node:fs';
import path from 'node:path';

import {isFrozen} from './handoff.mjs';
import {checkVerifierResult} from './result_check.mjs';
import {assertSpecUnchanged} from './spec.mjs';
import {writeSummary} from './summary.mjs';

import {BudgetExceeded} from '../budgets.mjs';
import {EXIT, readJson, sha256File, StageSignal, writeCanonical} from '../common.mjs';

const MAX_BLOCKER = 380;
const REJECTED = 'agent-result.rejected.json';
const ERRORS = 'agent-result.errors.json';

function loadRecords(ctx) {
    const control = ctx.readJson(2, 'control.json', 'orch#control-record');
    const trace = ctx.readJson(2, 'failure-trace.json', 'orch#failure-trace');
    return {
        control,
        trace,
        record: {
            spec_sha256: ctx.flags.verifySpec.sha256,
            failing_line: control.expectation.failing_line,
            expect_call: control.expectation.expected_failing_assertion_text,
            message_first_line: trace.message_first_line,
            expects_up_to_failing: control.expectation.expects_up_to_failing,
        },
    };
}

function rejectResult(ctx, resultAbs, errors, paths) {
    fs.renameSync(resultAbs, path.join(ctx.dir, REJECTED));
    writeCanonical(path.join(ctx.dir, ERRORS), {errors});
    ctx.state.invalid_results += 1;
    ctx.state.retries_used += 1;
    if (ctx.state.retries_used > ctx.budget.retries) {
        throw new BudgetExceeded(
            'retries_exceeded',
            `the verifier result was invalid ${ctx.state.invalid_results} times: ${errors[0]}`,
        );
    }
    throw new StageSignal(
        EXIT.AGENT_INVALID,
        'agent_invalid',
        `verifier result rejected: ${errors.slice(0, 3).join('; ')}`,
        paths,
    );
}

const readIfExists = (file) => (fs.existsSync(file) ? readJson(file) : null);

function incomplete(ctx, {task, control, trace, record, dispatch, proc, blocker, deliveryChecks = {}, resultSha}) {
    const reason = blocker.slice(0, MAX_BLOCKER);
    ctx.writeJson(
        'collect.json',
        {
            schema: 'explorer-collect-record/v1',
            task_id: dispatch.delivery.task_id,
            result_sha256: resultSha ?? null,
            accepted: false,
            blocker: reason,
            delivery_checks: deliveryChecks,
            verifier_verdict: 'none',
            run_verdict: 'incomplete',
            hard_failure: null,
            checks: {},
            cross_checked: {
                spec_sha256: record.spec_sha256,
                failing_line: record.failing_line,
                expects_up_to_failing: record.expects_up_to_failing,
            },
        },
        'orch#collect-record',
    );
    const outcome = {result: 'incomplete', reason};
    writeSummary({
        ctx,
        control,
        trace,
        verifierResult: null,
        collect: {verdict: 'incomplete', hardFailure: null, blocker: reason, dispatch, proc, task},
        collectOutcome: outcome,
    });
    return outcome;
}

/** Collection after a process delivery: every binding is checked by code; anything missing leaves the run incomplete. */
function collectProcess(ctx, {task, control, trace, record, dispatch}) {
    const {delivery} = dispatch;
    const taskAbs = path.join(ctx.out, delivery.task_file);
    const traceAbs = path.join(ctx.out, delivery.trace_file);
    const resultAbs = path.join(ctx.out, 'verify', 'agent-result.json');
    const proc = readIfExists(path.join(ctx.out, 'verify', 'process.json'));
    const base = {task, control, trace, record, dispatch, proc};
    const sameBytes = (file, sha) => fs.existsSync(file) && sha256File(file) === sha;
    if (!sameBytes(taskAbs, delivery.task_sha256)) {
        return incomplete(ctx, {
            ...base,
            blocker: 'the frozen task file is missing or its bytes changed after the dispatch was recorded',
        });
    }
    if (!sameBytes(traceAbs, delivery.trace_sha256)) {
        return incomplete(ctx, {
            ...base,
            blocker: 'the frozen failure trace is missing or its bytes changed after the dispatch was recorded',
        });
    }
    if (!proc) {
        return incomplete(ctx, {...base, blocker: 'the verifier process did not run (no process record)'});
    }
    if (!fs.existsSync(resultAbs)) {
        return incomplete(ctx, {...base, blocker: proc.blocker ?? 'the verifier process produced no result'});
    }
    const text = fs.readFileSync(resultAbs, 'utf8');
    const resultSha = sha256File(resultAbs);
    let result = null;
    try {
        result = JSON.parse(text);
    } catch {
        result = null;
    }
    const checked =
        result === null
            ? {errors: ['/: result file is not valid JSON'], hardFailure: null, conditions: {}, delivery: {}}
            : checkVerifierResult({result, task, record, text, delivery});
    if (checked.errors.length > 0) {
        fs.renameSync(resultAbs, path.join(ctx.dir, REJECTED));
        writeCanonical(path.join(ctx.dir, ERRORS), {errors: checked.errors});
        return incomplete(ctx, {
            ...base,
            blocker: `verifier result rejected: ${checked.errors.slice(0, 3).join('; ')}`,
            deliveryChecks: checked.delivery,
            resultSha,
        });
    }
    for (const extra of [REJECTED, ERRORS]) {
        fs.rmSync(path.join(ctx.dir, extra), {force: true});
    }
    const verdict = checked.hardFailure ? 'fail' : result.verdict;
    ctx.writeJson(
        'collect.json',
        {
            schema: 'explorer-collect-record/v1',
            task_id: task.task_id,
            result_sha256: resultSha,
            accepted: true,
            delivery_checks: {
                ...checked.delivery,
                task_read_only: isFrozen(taskAbs),
                trace_read_only: isFrozen(traceAbs),
            },
            verifier_verdict: result.verdict,
            run_verdict: verdict,
            hard_failure: checked.hardFailure,
            checks: checked.conditions,
            cross_checked: {
                spec_sha256: record.spec_sha256,
                failing_line: record.failing_line,
                expects_up_to_failing: record.expects_up_to_failing,
            },
        },
        'orch#collect-record',
    );
    const outcome = checked.hardFailure
        ? {result: 'fail', reason: 'spec_hash_mismatch: the verifier saw a different spec than the one recorded'}
        : {
              pass: {result: 'pass', reason: 'independent reproduction verified (deterministic verifier process)'},
              fail: {result: 'fail', reason: 'the verifier did not reproduce the controlled failure'},
              blocked: {result: 'blocked', reason: 'the verifier reported blocked'},
          }[verdict];
    writeSummary({
        ctx,
        control,
        trace,
        verifierResult: result,
        collect: {verdict, hardFailure: checked.hardFailure, dispatch, proc, task},
        collectOutcome: outcome,
    });
    return outcome;
}

export default {
    index: 4,
    name: 'collect',

    inputs(ctx) {
        const out = ctx.out;
        const hashOf = (rel) => (fs.existsSync(path.join(out, rel)) ? sha256File(path.join(out, rel)) : null);
        return [
            {task: hashOf('verify/agent-task.json')},
            {result: hashOf('verify/agent-result.json')},
            {process: hashOf('verify/process.json')},
            {trace: hashOf('2-control/failure-trace.json')},
            {control: hashOf('2-control/control.json')},
            {spec: ctx.flags.verifySpec.sha256},
        ];
    },

    async run(ctx) {
        const {flags} = ctx;
        assertSpecUnchanged(flags);
        if (!flags.live) {
            return {result: 'skipped', reason: 'skipped: not live (no verifier was dispatched)'};
        }
        const taskAbs = path.join(ctx.out, 'verify', 'agent-task.json');
        const resultAbs = path.join(ctx.out, 'verify', 'agent-result.json');
        const dispatch = readJson(path.join(ctx.out, 'verify', 'dispatch.json'));
        if (dispatch.delivery) {
            const {control, trace, record} = loadRecords(ctx);
            let delivered = null;
            try {
                delivered = readJson(taskAbs);
            } catch {
                delivered = null;
            }
            return collectProcess(ctx, {task: delivered, control, trace, record, dispatch});
        }
        const task = readJson(taskAbs);
        if (!fs.existsSync(resultAbs)) {
            throw new StageSignal(EXIT.AWAITING_AGENT, 'awaiting_agent', 'awaiting the independent verifier result', {
                taskAbs,
                resultAbs,
            });
        }
        const {control, trace, record} = loadRecords(ctx);
        const text = fs.readFileSync(resultAbs, 'utf8');
        let result;
        try {
            result = JSON.parse(text);
        } catch {
            result = null;
        }
        const paths = {taskAbs, resultAbs};
        const attempt = ctx.state.invalid_results + 1;
        const checked =
            result === null
                ? {errors: ['/: result file is not valid JSON'], hardFailure: null, conditions: {}}
                : checkVerifierResult({result, task, record, text});
        const callLogged = ctx.hasLoggedOk(task.task_id);
        if (!callLogged || checked.errors.length > 0) {
            ctx.assertAgentCallAllowed();
            ctx.logAgentCall({
                role: task.role,
                provider: 'manual',
                task_id: task.task_id,
                attempt,
                outcome: checked.errors.length > 0 ? 'invalid' : 'ok',
            });
        }
        if (checked.errors.length > 0) {
            rejectResult(ctx, resultAbs, checked.errors, paths);
        }
        for (const extra of [REJECTED, ERRORS]) {
            fs.rmSync(path.join(ctx.dir, extra), {force: true});
        }

        const verdict = checked.hardFailure ? 'fail' : result.verdict;
        ctx.writeJson(
            'collect.json',
            {
                schema: 'explorer-collect-record/v1',
                task_id: task.task_id,
                result_sha256: sha256File(resultAbs),
                accepted: true,
                verifier_verdict: result.verdict,
                run_verdict: verdict,
                hard_failure: checked.hardFailure,
                checks: checked.conditions,
                cross_checked: {
                    spec_sha256: record.spec_sha256,
                    failing_line: record.failing_line,
                    expects_up_to_failing: record.expects_up_to_failing,
                },
            },
            'orch#collect-record',
        );
        const outcome = checked.hardFailure
            ? {result: 'fail', reason: 'spec_hash_mismatch: the verifier saw a different spec than the one recorded'}
            : {
                  pass: {result: 'pass', reason: 'independent reproduction verified'},
                  fail: {result: 'fail', reason: 'the verifier did not reproduce the controlled failure'},
                  blocked: {result: 'blocked', reason: 'the verifier reported blocked'},
              }[verdict];
        writeSummary({
            ctx,
            control,
            trace,
            verifierResult: result,
            collect: {verdict, hardFailure: checked.hardFailure, dispatch, proc: null, task},
            collectOutcome: outcome,
        });
        return outcome;
    },
};
