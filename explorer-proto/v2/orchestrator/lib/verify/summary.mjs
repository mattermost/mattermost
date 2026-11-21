// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable @stylistic/indent, @stylistic/multiline-ternary, @stylistic/operator-linebreak -- Prettier owns formatting and the repo config relaxes these rules for .ts/.js only */

// The final run summary (summary.json and summary.md at the run directory root). A step reads "verified" only when the
// orchestrator produced it; the independent reproduction counts only because dispatch and collection both went
// through the orchestrator.
import fs from 'node:fs';
import path from 'node:path';

import {assertSpecUnchanged} from './spec.mjs';

import {canonicalJson, readJson, writeFileAtomic} from '../common.mjs';
import {validate} from '../schemas.mjs';

const STAGE_DIRS = ['0-target', '1-baseline', '2-control', 'verify', 'collect'];

function stageStatuses(ctx, collectOutcome) {
    return STAGE_DIRS.map((dir, i) => {
        const file = path.join(ctx.out, dir, 'stage-record.json');
        let result = fs.existsSync(file) ? readJson(file).result : 'not_run';
        if (i === 4) {
            result = collectOutcome.result;
        }
        const entry = {stage: ctx.stageSet.names[i], dir, result};
        if (i === 0) {
            const status = path.join(ctx.out, dir, 'status.json');
            if (fs.existsSync(status)) {
                entry.attempts = readJson(status).attempts.map((a) => ({
                    attempt: a.attempt,
                    outcome: a.outcome,
                    reason: a.reason,
                }));
            }
        }
        return entry;
    });
}

const verifiedIf = (ok) => (ok ? 'verified' : 'failed');

export function writeSummary({ctx, control, trace, verifierResult, collect, collectOutcome}) {
    const {flags} = ctx;
    const recorded = flags.verifySpec.sha256;
    const baseline = readJson(path.join(ctx.out, '1-baseline', 'baseline.json'));
    const dispatch = readJson(path.join(ctx.out, 'verify', 'dispatch.json'));
    const setup = (() => {
        const status = readJson(path.join(ctx.out, '0-target', 'status.json'));
        return readJson(path.join(ctx.out, '0-target', `attempt-${status.current_attempt}`, 'setup.json'));
    })();

    const observations = [
        {stage: 'baseline', point: 'before', sha256: baseline.spec.sha256_before},
        {stage: 'baseline', point: 'after', sha256: baseline.spec.sha256_after},
        {stage: 'control', point: 'before', sha256: control.spec.sha256_before},
        {stage: 'control', point: 'after', sha256: control.spec.sha256_after},
        {stage: 'dispatch', point: 'at', sha256: dispatch.spec.sha256},
        {stage: 'collect', point: 'at', sha256: assertSpecUnchanged(flags)},
        {stage: 'verifier', point: 'observed', sha256: verifierResult.spec_sha256_observed},
    ];
    if (verifierResult.restored?.spec_sha_after) {
        observations.push({stage: 'verifier', point: 'after', sha256: verifierResult.restored.spec_sha_after});
    }
    const unchanged = observations.every((o) => o.sha256 === recorded);

    const independent = collect.hardFailure
        ? 'failed'
        : {pass: 'verified', fail: 'failed', blocked: 'blocked'}[verifierResult.verdict];
    const restoredByOrchestrator =
        control.restore.replay?.judge?.status === 'pass' && control.restore.replay.exit_code === 0;
    const restoredByVerifier =
        verifierResult.restored?.replay_pass === true && verifierResult.restored.judge === 'pass';

    const summary = {
        schema: 'explorer-run-summary/v1',
        run_id: flags.runId,
        session: flags.session,
        target: flags.target,
        image_digest: setup.image_digest,
        fixture_fingerprint: setup.fixture_fingerprint,
        spec: {path: flags.verifySpec.path, sha256: recorded, unchanged_at_every_stage: unchanged, observations},
        verification_control: {
            label: trace.label,
            id: control.control_id,
            declared_title: trace.mutation.declared_title,
            changed_title: trace.mutation.changed_title,
            note: 'The title change is a verification control applied to the fixture, not a product change; it was restored before dispatch.',
        },
        assertion: {
            spec_path: flags.verifySpec.path,
            line: control.expectation.failing_line,
            expect_call: control.expectation.expected_failing_assertion_text,
            test_title: control.expectation.test_title,
        },
        results: [
            {
                step: 'original_pass',
                produced_by: 'orchestrator',
                status: verifiedIf(baseline.result === 'pass'),
                detail: `replay exit ${baseline.replay.exit_code}, judge ${baseline.judge.status}/${baseline.judge.observed}`,
            },
            {
                step: 'controlled_failure',
                produced_by: 'orchestrator',
                status: verifiedIf(control.result === 'pass'),
                detail: `judge ${control.judge?.status}/${control.judge?.observed} at line ${control.expectation.failing_line}`,
            },
            {
                step: 'independent_reproduction',
                produced_by: 'independent verifier; dispatched and collected by the orchestrator',
                status: independent,
                detail: `verifier verdict ${verifierResult.verdict}${collect.hardFailure ? ' (spec hash mismatch)' : ''}`,
            },
            {
                step: 'restored_pass',
                produced_by: 'orchestrator and independent verifier',
                status: verifiedIf(restoredByOrchestrator && restoredByVerifier),
                detail: `orchestrator replay ${restoredByOrchestrator ? 'pass' : 'not pass'}; verifier replay ${restoredByVerifier ? 'pass' : 'not pass'}`,
            },
        ],
        stages: stageStatuses(ctx, collectOutcome),
        verdict: collectOutcome.result === 'pass' && unchanged ? 'pass' : collectOutcome.result,
    };
    const shape = validate('orch#run-summary', summary);
    if (!shape.ok) {
        throw new Error(`internal: run summary invalid: ${shape.errors[0]}`);
    }
    writeFileAtomic(path.join(ctx.out, 'summary.json'), canonicalJson(summary));
    writeFileAtomic(path.join(ctx.out, 'summary.md'), renderMarkdown(summary));
    return summary;
}

function renderMarkdown(s) {
    const rows = s.results.map((r) => `| ${r.step} | ${r.status} | ${r.produced_by} | ${r.detail} |`);
    const stages = s.stages.map((st) => {
        const attempts = st.attempts?.map((a) => `#${a.attempt} ${a.outcome} (${a.reason})`).join('; ') ?? '';
        return `| ${st.dir} | ${st.result} | ${attempts} |`;
    });
    return `${[
        `# Run ${s.run_id}: ${s.verdict}`,
        '',
        `Spec \`${s.spec.path}\` sha256 \`${s.spec.sha256}\`; unchanged at every stage: **${s.spec.unchanged_at_every_stage ? 'yes' : 'NO'}**.`,
        `Session ${s.session}, target ${s.target}, image digest \`${s.image_digest}\`, fixture fingerprint \`${s.fixture_fingerprint}\`.`,
        '',
        `The title change from "${s.verification_control.declared_title}" to "${s.verification_control.changed_title}" is a **${s.verification_control.label}**. ${s.verification_control.note}`,
        '',
        `Failing assertion: \`${s.assertion.spec_path}:${s.assertion.line}\` \`${s.assertion.expect_call}\``,
        '',
        '| Step | Status | Produced by | Detail |',
        '| --- | --- | --- | --- |',
        ...rows,
        '',
        '| Stage | Result | Attempts |',
        '| --- | --- | --- |',
        ...stages,
    ].join('\n')}\n`;
}
