// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Validation of the independent verifier's result against the orchestrator's own records. The verdict is advisory:
// it can never turn a deterministic mismatch into a pass, and a pass claim must agree with every field it rests on.
import {unsafeFindings} from './trace.mjs';

import {normalizeCall} from '../../../gates/replay_judge.mjs';
import {validate} from '../schemas.mjs';

const firstLine = (text) =>
    String(text ?? '')
        .split('\n')[0]
        .replace(/^Error:\s*/, '')
        .trim();

/** What the result must show for `pass`, as named conditions over its fields. */
export function passConditions(result, record) {
    const r = result;
    return {
        clean_fixture_confirmed: r.clean_fixture_confirmed === true,
        baseline_passed:
            r.baseline_pass?.exit === 0 && r.baseline_pass.passed === true && r.baseline_pass.judge === 'pass',
        control_accepted: r.control_applied?.accepted === true,
        failure_judged_at_named_assertion: r.reproduced_failure?.judge === 'pass',
        single_error: r.reproduced_failure?.only_one_error === true,
        failing_line_matches: r.reproduced_failure?.failing_line === record.failing_line,
        failing_call_matches: normalizeCall(r.reproduced_failure?.expect_call) === normalizeCall(record.expect_call),
        message_first_line_matches: firstLine(r.reproduced_failure?.message_first_line) === record.message_first_line,
        evidence_covers_expects_up_to_failing:
            r.reproduced_failure?.step_evidence_summary?.length === record.expects_up_to_failing,
        restored_readback: r.restored?.readback === true,
        restored_id_same: r.restored?.id_same === true,
        restored_seed_check: r.restored?.seed_check === true,
        restored_replay_passed: r.restored?.replay_pass === true && r.restored.judge === 'pass',
    };
}

/**
 * The byte-exact binding of a result to its dispatch (process delivery). Returns {checks, errors}: `checks` are named
 * booleans for the collect record, `errors` are JSON-path and rule lines only.
 */
export function deliveryChecks(result, delivery, record) {
    const receipt = result.receipt;
    const checks = {
        receipt_present: Boolean(receipt),
        receipt_run_id: receipt?.run_id === delivery.run_id,
        receipt_task_id: receipt?.task_id === delivery.task_id && result.task_id === delivery.task_id,
        receipt_dispatch_nonce: receipt?.dispatch_nonce === delivery.dispatch_nonce,
        receipt_task_sha256: receipt?.task_sha256_observed === delivery.task_sha256,
        receipt_trace_sha256: receipt?.trace_sha256_observed === delivery.trace_sha256,
        receipt_verifier_kind: receipt?.verifier_kind === 'deterministic-process',
    };
    const errors = [];
    const rules = {
        receipt_run_id: '/receipt/run_id: belongs to a different run',
        receipt_task_id: '/receipt/task_id: does not match the dispatched task',
        receipt_dispatch_nonce:
            '/receipt/dispatch_nonce: does not match the current dispatch (stale or foreign result)',
        receipt_task_sha256: '/receipt/task_sha256_observed: differs from the dispatched task hash',
        receipt_trace_sha256: '/receipt/trace_sha256_observed: differs from the dispatched trace hash',
        receipt_verifier_kind: '/receipt/verifier_kind: is not the deterministic process',
    };
    if (checks.receipt_present) {
        errors.push(
            ...Object.entries(rules)
                .filter(([name]) => !checks[name])
                .map(([, rule]) => rule),
        );
    } else {
        errors.push('/receipt: missing, the result is not bound to this dispatch');
    }
    const failure = result.reproduced_failure;
    checks.assertion_equals_orchestrator =
        failure === null ||
        failure === undefined ||
        (failure.failing_line === record.failing_line &&
            normalizeCall(failure.expect_call) === normalizeCall(record.expect_call));
    if (!checks.assertion_equals_orchestrator) {
        errors.push(
            '/reproduced_failure: failing line or expect call differs from the orchestrator record (wrong assertion)',
        );
    }
    return {checks, errors};
}

/**
 * Returns {errors, hardFailure, conditions, delivery}. `errors` are JSON-path and rule lines only (no instance data): when
 * non-empty the result is set aside and the task stays open. `hardFailure` names a spec hash mismatch, which fails the
 * run instead.
 */
export function checkVerifierResult({result, task, record, text, delivery = null}) {
    const shape = validate('verifier', result);
    if (!shape.ok) {
        return {errors: shape.errors, hardFailure: null, conditions: {}, delivery: {}};
    }
    const errors = [];
    const bound = delivery ? deliveryChecks(result, delivery, record) : {checks: {}, errors: []};
    errors.push(...bound.errors);
    if (result.task_id !== task.task_id) {
        errors.push('/task_id: does not match the task (stale or foreign result)');
    }
    const leaks = unsafeFindings(text, {allowSlugs: true});
    if (leaks.length > 0) {
        errors.push(`/: the result text matches the unsafe-text scan (${leaks.join(', ')})`);
    }
    const nested = ['baseline_pass', 'control_applied', 'reproduced_failure', 'restored'];
    const missing = nested.filter((k) => result[k] === null);
    if (missing.length > 0 && result.verdict !== 'blocked') {
        errors.push(`/${missing[0]}: null is only allowed with verdict blocked`);
    }
    let hardFailure = null;
    const shas = [result.spec_sha256_observed, result.restored?.spec_sha_after].filter(Boolean);
    if (shas.some((s) => s !== record.spec_sha256)) {
        hardFailure = 'spec_hash_mismatch';
    }
    const conditions = passConditions(result, record);
    const allGood = Object.values(conditions).every(Boolean) && shas.length === 2;
    if (result.verdict === 'pass' && !allGood) {
        const bad = Object.entries(conditions)
            .filter(([, ok]) => !ok)
            .map(([name]) => name);
        errors.push(
            `/verdict: pass contradicts the records (${bad.length > 0 ? bad.join(', ') : 'spec hash fields missing'})`,
        );
    }
    if (result.verdict !== 'pass' && allGood && !hardFailure) {
        errors.push(`/verdict: ${result.verdict} contradicts fields that all show success`);
    }
    return {errors, hardFailure, conditions, delivery: bound.checks};
}
