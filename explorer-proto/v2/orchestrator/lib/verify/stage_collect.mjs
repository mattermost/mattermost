// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable @stylistic/indent, @stylistic/multiline-ternary, @stylistic/operator-linebreak -- Prettier owns formatting and the repo config relaxes these rules for .ts/.js only */

// S4, collect: validates the independent verifier's result (verify/agent-result.json) against the schema and the
// orchestrator's own records, then writes the run summary. A result that contradicts the records is set aside (exit 21);
// a spec hash mismatch fails the run.
import fs from 'node:fs';
import path from 'node:path';

import {checkVerifierResult} from './result_check.mjs';
import {assertSpecUnchanged} from './spec.mjs';
import {writeSummary} from './summary.mjs';

import {BudgetExceeded} from '../budgets.mjs';
import {EXIT, readJson, sha256File, StageSignal, writeCanonical} from '../common.mjs';

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

export default {
    index: 4,
    name: 'collect',

    inputs(ctx) {
        const out = ctx.out;
        const hashOf = (rel) => (fs.existsSync(path.join(out, rel)) ? sha256File(path.join(out, rel)) : null);
        return [
            {task: hashOf('verify/agent-task.json')},
            {result: hashOf('verify/agent-result.json')},
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
            collect: {verdict, hardFailure: checked.hardFailure},
            collectOutcome: outcome,
        });
        return outcome;
    },
};
