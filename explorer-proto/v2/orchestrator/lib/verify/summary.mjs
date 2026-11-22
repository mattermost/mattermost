// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable @stylistic/indent, @stylistic/multiline-ternary, @stylistic/operator-linebreak -- Prettier owns formatting and the repo config relaxes these rules for .ts/.js only */

// The final run summary (summary.json and summary.md at the run directory root). A step reads "verified" only when the
// orchestrator produced it; the independent reproduction counts only because dispatch and collection both went
// through the orchestrator. Without a verifier result the independent rows read "pending" and the verdict "incomplete".
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
const PROCESS_PRODUCER =
    'deterministic verifier process (separate OS process, same worker); dispatched and collected by the orchestrator';

function deliverySection({dispatch, proc, verifierResult}) {
    const delivery = dispatch.delivery ?? null;
    const receipt = verifierResult?.receipt ?? null;
    const sent = delivery?.dispatch_nonce ?? null;
    const echo = receipt?.dispatch_nonce ?? null;
    const taskObserved = receipt?.task_sha256_observed ?? null;
    const traceObserved = receipt?.trace_sha256_observed ?? null;
    return {
        mode: delivery?.mode ?? 'manual: agent task file and result file',
        verifier_kind: delivery ? delivery.verifier.kind : 'agent (manual or cmd provider)',
        dispatch_nonce_sent: sent,
        nonce_echo: echo,
        nonce_echo_matches: sent !== null && sent === echo,
        task_sha256_dispatched: delivery?.task_sha256 ?? null,
        task_sha256_observed: taskObserved,
        trace_sha256_dispatched: delivery?.trace_sha256 ?? null,
        trace_sha256_observed: traceObserved,
        hashes_match:
            delivery !== null && taskObserved === delivery.task_sha256 && traceObserved === delivery.trace_sha256,
        verifier_exit_code: proc?.exit_code ?? null,
        verifier_elapsed_seconds: proc ? proc.elapsed_seconds : null,
    };
}

function fixtureAttempts(ctx) {
    const file = path.join(ctx.out, '0-target', 'status.json');
    if (!fs.existsSync(file)) {
        return [];
    }
    return readJson(file).attempts.map((a) => {
        const setup = path.join(ctx.out, '0-target', a.dir, 'setup.json');
        return {
            attempt: a.attempt,
            outcome: a.outcome,
            fingerprint: fs.existsSync(setup) ? (readJson(setup).fixture_fingerprint ?? null) : null,
        };
    });
}

function supersededDirs(ctx) {
    const root = path.join(ctx.out, 'superseded');
    return fs.existsSync(root)
        ? fs
              .readdirSync(root)
              .sort()
              .map((n) => `superseded/${n}`)
        : [];
}

export function writeSummary({ctx, control, trace, verifierResult, collect, collectOutcome}) {
    const {flags} = ctx;
    const recorded = flags.verifySpec.sha256;
    const baseline = readJson(path.join(ctx.out, '1-baseline', 'baseline.json'));
    const dispatch = collect.dispatch ?? readJson(path.join(ctx.out, 'verify', 'dispatch.json'));
    const proc = collect.proc ?? null;
    const viaProcess = Boolean(dispatch.delivery);
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
    ];
    if (verifierResult) {
        observations.push({stage: 'verifier', point: 'observed', sha256: verifierResult.spec_sha256_observed});
        if (verifierResult.restored?.spec_sha_after) {
            observations.push({stage: 'verifier', point: 'after', sha256: verifierResult.restored.spec_sha_after});
        }
    }
    const unchanged = observations.every((o) => o.sha256 === recorded);

    let independent = 'pending';
    if (verifierResult) {
        independent = collect.hardFailure
            ? 'failed'
            : {pass: 'verified', fail: 'failed', blocked: 'blocked'}[verifierResult.verdict];
    }
    const restoredByOrchestrator =
        control.restore.replay?.judge?.status === 'pass' && control.restore.replay.exit_code === 0;
    const restoredByVerifier =
        verifierResult?.restored?.replay_pass === true && verifierResult.restored.judge === 'pass';
    let restoredStatus = verifiedIf(restoredByOrchestrator && restoredByVerifier);
    if (!verifierResult) {
        restoredStatus = restoredByOrchestrator ? 'pending' : 'failed';
    }
    let verifierReplay = 'not received';
    if (verifierResult) {
        verifierReplay = restoredByVerifier ? 'pass' : 'not pass';
    }
    const producer = viaProcess
        ? PROCESS_PRODUCER
        : 'independent verifier; dispatched and collected by the orchestrator';
    const verifierDetail = verifierResult
        ? `verifier verdict ${verifierResult.verdict}${collect.hardFailure ? ' (spec hash mismatch)' : ''}`
        : `no accepted verifier result: ${collect.blocker ?? 'none received'}`;

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
                produced_by: producer,
                status: independent,
                detail: verifierDetail.slice(0, 300),
            },
            {
                step: 'restored_pass',
                produced_by: viaProcess
                    ? `orchestrator and ${PROCESS_PRODUCER.split(';')[0]}`
                    : 'orchestrator and independent verifier',
                status: restoredStatus,
                detail: `orchestrator replay ${restoredByOrchestrator ? 'pass' : 'not pass'}; verifier replay ${verifierReplay}`,
            },
        ],
        stages: stageStatuses(ctx, collectOutcome),
        verdict: collectOutcome.result === 'pass' && unchanged ? 'pass' : collectOutcome.result,
        delivery: deliverySection({dispatch, proc, verifierResult}),
        fixture_attempts: fixtureAttempts(ctx),
        superseded: supersededDirs(ctx),
        ...(collect.blocker ? {blocker: collect.blocker} : {}),
    };
    const shape = validate('orch#run-summary', summary);
    if (!shape.ok) {
        throw new Error(`internal: run summary invalid: ${shape.errors[0]}`);
    }
    writeFileAtomic(path.join(ctx.out, 'summary.json'), canonicalJson(summary));
    writeFileAtomic(path.join(ctx.out, 'summary.md'), renderMarkdown(summary));
    return summary;
}

const short = (hash) => (hash ? hash.slice(0, 16) : 'none');

export function renderMarkdown(s) {
    const rows = s.results.map((r) => `| ${r.step} | ${r.status} | ${r.produced_by} | ${r.detail} |`);
    const stages = s.stages.map((st) => {
        const attempts = st.attempts?.map((a) => `#${a.attempt} ${a.outcome} (${a.reason})`).join('; ') ?? '';
        return `| ${st.dir} | ${st.result} | ${attempts} |`;
    });
    const d = s.delivery;
    const delivery = d
        ? [
              '',
              `Delivery: ${d.mode}; verifier kind: ${d.verifier_kind}.`,
              `Nonce sent \`${d.dispatch_nonce_sent ?? 'none'}\`, echoed \`${d.nonce_echo ?? 'none'}\` (matches: ${d.nonce_echo_matches ? 'yes' : 'no'}).`,
              `Task sha256 dispatched \`${short(d.task_sha256_dispatched)}\`, observed \`${short(d.task_sha256_observed)}\`; trace sha256 dispatched \`${short(d.trace_sha256_dispatched)}\`, observed \`${short(d.trace_sha256_observed)}\` (all equal: ${d.hashes_match ? 'yes' : 'no'}).`,
              `Verifier process exit ${d.verifier_exit_code ?? 'none'}, ${d.verifier_elapsed_seconds === null ? 'no elapsed time' : `${d.verifier_elapsed_seconds.toFixed(1)}s`}.`,
          ]
        : [];
    const fixtures = (s.fixture_attempts ?? []).map(
        (a) => `| ${a.attempt} | ${a.outcome} | \`${short(a.fingerprint)}\` |`,
    );
    return `${[
        `# Run ${s.run_id}: ${s.verdict}`,
        '',
        ...(s.blocker ? [`**Blocker:** ${s.blocker}`, ''] : []),
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
        ...delivery,
        '',
        '| Stage | Result | Attempts |',
        '| --- | --- | --- |',
        ...stages,
        ...(fixtures.length > 0
            ? ['', '| Attempt | Outcome | Fixture fingerprint |', '| --- | --- | --- |', ...fixtures]
            : []),
        ...(s.superseded?.length > 0 ? ['', `Superseded by a new fixture: ${s.superseded.join(', ')}.`] : []),
    ].join('\n')}\n`;
}
