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
 * Returns {errors, hardFailure, conditions}. `errors` are JSON-path and rule lines only (no instance data): when
 * non-empty the result is set aside and the task stays open. `hardFailure` names a spec hash mismatch, which fails the
 * run instead.
 */
export function checkVerifierResult({result, task, record, text}) {
    const shape = validate('verifier', result);
    if (!shape.ok) {
        return {errors: shape.errors, hardFailure: null, conditions: {}};
    }
    const errors = [];
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
    return {errors, hardFailure, conditions};
}
