// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable @stylistic/multiline-ternary, @stylistic/operator-linebreak, @stylistic/wrap-regex -- Prettier owns formatting and the repo config relaxes these rules for .ts/.js only */

// Stage 4, select: an agent proposes charters (with a coverage candidate each); CODE then runs the schema check, the
// leakage checker and the coverage duplicate gate on every proposal. Likely duplicates and leaking charters are
// rejected with evidence; needs_review proposals go to a reviewer agent whose answer must cite file:line on all three
// comparison axes.
import path from 'node:path';

import {dirDigest} from './util.mjs';

import {ORCH_REPO_PATH, sha256File, slug, writeCanonical} from '../common.mjs';
import {featureFile} from '../feature.mjs';
import {checkProposedCharter} from '../leakage.mjs';
import {validate} from '../schemas.mjs';
import {buildVerdict} from '../verdicts.mjs';

const TEST_ID = /^[A-Z][A-Z0-9]*-[A-Za-z0-9_]+$/;

function testRef(result) {
    const t = result.test;
    const testId = (t.mm_t_ids ?? []).find((id) => TEST_ID.test(id));
    return {suite: t.suite, file: t.file, line: t.line, ...(testId ? {test_id: testId} : {})};
}

function atFile(at) {
    return /^([A-Za-z0-9_.@+/-]+):[0-9]+/.exec(at ?? '')?.[1] ?? null;
}

/** Files a reviewer may legitimately cite: the compared tests and every file the report matched. */
function citableFiles(report) {
    const files = new Set();
    for (const r of report.results) {
        files.add(r.test.file);
        const collect = (list) => list?.forEach((e) => [atFile(e.at), atFile(e.via)].forEach((f) => f && files.add(f)));
        collect(r.axes.transitions.test);
        collect(r.axes.final_assertions.test);
        collect(r.matched.ui);
        collect(r.matched.assertions);
        for (const line of r.axes.actor_setup.test.setup) {
            const f = atFile(line.split(' @ ').pop());
            if (f) {
                files.add(f);
            }
        }
    }
    return files;
}

function reviewChecker(pending) {
    const byId = new Map(pending.map((p) => [p.charterId, p]));
    return (result) => {
        const errors = [];
        const seen = new Set();
        for (const review of result.reviews) {
            const item = byId.get(review.charter_id);
            if (!item) {
                errors.push(`/reviews: unknown charter ${review.charter_id}`);
                continue;
            }
            if (seen.has(review.charter_id)) {
                errors.push(`/reviews: charter ${review.charter_id} reviewed twice`);
            }
            seen.add(review.charter_id);
            const files = citableFiles(item.report);
            for (const axis of ['actors_setup', 'transitions', 'final_assertions']) {
                for (const c of review.axes[axis].citations) {
                    if (!files.has(c.file)) {
                        errors.push(
                            `/reviews/${review.charter_id}/axes/${axis}: ${c.file} is not in the coverage report`,
                        );
                    }
                }
            }
            const known = item.report.results.some(
                (r) => r.test.file === review.compared_test.file && r.test.line === review.compared_test.line,
            );
            if (!known) {
                errors.push(
                    `/reviews/${review.charter_id}/compared_test: not one of the ranked tests in the coverage report`,
                );
            }
        }
        for (const id of byId.keys()) {
            if (!seen.has(id)) {
                errors.push(`/reviews: charter ${id} is missing`);
            }
        }
        return errors;
    };
}

export default {
    index: 4,
    name: 'select',
    modes: ['author', 'both'],

    async inputs(ctx) {
        return [
            {feature: sha256File(featureFile(ctx.flags.feature))},
            {target: dirDigest(ctx, 0)},
            {index: dirDigest(ctx, 1)},
            {triage: dirDigest(ctx, 3)},
        ];
    },

    async run(ctx) {
        const feature = ctx.feature;
        const featureRepo = `${ORCH_REPO_PATH}/features/${feature.id}.json`;
        const proposed = await ctx.agent({
            role: 'charter-proposer',
            prompt: 'select.md',
            inputs: [
                {path: featureRepo, base: 'repo', purpose: 'feature definition: general action rules and budget'},
                {path: '0-target/target.json', base: 'out', purpose: 'build under test'},
                {path: '1-index/index-summary.json', base: 'out', purpose: 'coverage index summary'},
                {
                    path: '1-index/data/tests.jsonl',
                    base: 'out',
                    purpose: 'existing tests, one JSON record per line (read-only search)',
                },
                ...(ctx.exists(3, 'triage-summary.json')
                    ? [{path: '3-triage/triage-summary.json', base: 'out', purpose: 'findings of the explore stage'}]
                    : []),
            ],
            schemaRef: 'agent#select',
        });

        const {loadIndex} = await import('../../../index/extract.mjs');
        const {runCheck} = await import('../../../index/coverage-check.mjs');
        const {tests} = loadIndex(path.join(ctx.out, '1-index', 'data'));

        const decisions = [];
        const pending = [];
        const keys = new Map();
        const usedIds = new Set();
        const bakeoff = feature.bakeoff_feature;

        const reject = ({
            charterId,
            id,
            decision,
            leakage,
            coverage,
            reviewed,
            evidence,
            gates,
            duplicateOf,
            violations,
            outcome,
        }) => {
            const verdictFile = `verdicts/${slug(id)}.verdict.json`;
            const verdict = buildVerdict({subjectId: id, outcome, gates, bakeoffFeature: bakeoff, duplicateOf});
            ctx.writeJson(verdictFile, verdict, 'verdict');
            decisions.push({
                charter_id: charterId,
                decision,
                leakage,
                coverage_verdict: coverage,
                reviewed,
                evidence,
                ...(violations ? {violations} : {}),
                ...(duplicateOf ? {duplicate_of: duplicateOf} : {}),
                verdict_file: ctx.stageRel(verdictFile),
            });
        };

        for (const [i, proposal] of proposed.proposals.entries()) {
            const rawId = proposal.charter?.charter_id;
            const idCheck = validate('common#id', rawId);
            let id = idCheck.ok ? rawId : `proposal-${i + 1}`;
            if (usedIds.has(id)) {
                id = `${id.slice(0, 80)}-dup${i + 1}`;
            }
            usedIds.add(id);
            const s = slug(id);
            const shape = validate('charter', proposal.charter);

            if (!shape.ok || proposal.charter.schema !== 'explorer-charter/v2') {
                const errors = shape.ok ? ['/schema: the proposer must return explorer-charter/v2'] : shape.errors;
                ctx.writeJson(`rejected/${s}.errors.json`, {errors}, null);
                const ref = {kind: 'report', ref: ctx.stageRel(`rejected/${s}.errors.json`)};
                reject({
                    charterId: id,
                    id,
                    decision: 'rejected_schema',
                    leakage: 'not_run',
                    coverage: 'not_run',
                    reviewed: false,
                    evidence: [ref],
                    gates: [{gate: 'schema', result: 'fail', evidence: [ref]}],
                    outcome: 'failed',
                });
                continue;
            }

            const charterRef = {kind: 'spec', ref: ctx.stageRel(`proposed/${s}.json`)};
            ctx.writeJson(`proposed/${s}.json`, proposal.charter, 'charter');
            const schemaGate = {gate: 'schema', result: 'pass', evidence: [charterRef]};

            const key = proposal.charter.dedupe?.key ?? id;
            if (keys.has(key)) {
                reject({
                    charterId: id,
                    id,
                    decision: 'rejected_dedupe_key',
                    leakage: 'not_run',
                    coverage: 'not_run',
                    reviewed: false,
                    evidence: [{kind: 'report', ref: keys.get(key)}],
                    gates: [
                        schemaGate,
                        {gate: 'duplicate', result: 'fail', evidence: [{kind: 'report', ref: keys.get(key)}]},
                    ],
                    outcome: 'failed',
                });
                continue;
            }
            keys.set(key, ctx.stageRel(`proposed/${s}.json`));

            const leak = checkProposedCharter(proposal.charter);
            ctx.writeJson(`leakage/${s}.json`, leak, null);
            const leakRef = {kind: 'report', ref: ctx.stageRel(`leakage/${s}.json`)};
            if (!leak.pass) {
                reject({
                    charterId: id,
                    id,
                    decision: 'rejected_leakage',
                    leakage: 'fail',
                    coverage: 'not_run',
                    reviewed: false,
                    evidence: [leakRef],
                    violations: leak.violations.slice(0, 20),
                    gates: [schemaGate, {gate: 'leakage', result: 'fail', evidence: [leakRef]}],
                    outcome: 'failed',
                });
                continue;
            }
            const leakGate = {gate: 'leakage', result: 'pass', evidence: [leakRef]};

            const report = runCheck({tests, candidate: proposal.candidate});
            const reportShape = validate('orch#coverage-report', report);
            if (!reportShape.ok) {
                throw new Error(`coverage report invalid: ${reportShape.errors[0]}`);
            }
            const stored = {...report};
            delete stored.all_scores;
            writeCanonical(path.join(ctx.dir, 'coverage', `${s}.json`), stored);
            const reportRef = {kind: 'report', ref: ctx.stageRel(`coverage/${s}.json`)};

            if (report.verdict === 'likely_duplicate') {
                const top = report.results[0];
                const covering = {kind: 'source', ref: `${top.test.file}:${top.test.line}`};
                reject({
                    charterId: id,
                    id,
                    decision: 'rejected_duplicate',
                    leakage: 'pass',
                    coverage: 'likely_duplicate',
                    reviewed: false,
                    evidence: [reportRef, covering],
                    duplicateOf: testRef(top),
                    gates: [schemaGate, leakGate, {gate: 'duplicate', result: 'fail', evidence: [reportRef, covering]}],
                    outcome: 'rejected_duplicate',
                });
                continue;
            }
            const item = {
                charterId: id,
                id,
                s,
                charter: proposal.charter,
                report,
                reportRef,
                charterRef,
                leakRef,
                schemaGate,
                leakGate,
            };
            if (report.verdict === 'needs_review') {
                pending.push(item);
                continue;
            }
            accept(ctx, decisions, item, 'no_close_match', false);
        }

        if (pending.length) {
            const reviewed = await ctx.agent({
                name: 'review',
                role: 'duplicate-reviewer',
                prompt: 'review.md',
                inputs: pending.flatMap((p) => [
                    {path: p.reportRef.ref, base: 'out', purpose: `coverage report for ${p.charterId}`},
                    {path: p.charterRef.ref, base: 'out', purpose: `proposed charter ${p.charterId}`},
                ]),
                schemaRef: 'agent#review',
                check: reviewChecker(pending),
            });
            for (const p of pending) {
                const review = reviewed.reviews.find((r) => r.charter_id === p.charterId);
                if (review.judgement === 'non_equivalent') {
                    accept(ctx, decisions, p, 'needs_review', true);
                    continue;
                }
                const cited = review.axes.final_assertions.citations[0];
                const covering = {kind: 'source', ref: `${cited.file}:${cited.line}`};
                const comparedRef = {kind: 'source', ref: `${review.compared_test.file}:${review.compared_test.line}`};
                reject({
                    charterId: p.charterId,
                    id: p.id,
                    decision: 'rejected_duplicate',
                    leakage: 'pass',
                    coverage: 'needs_review',
                    reviewed: true,
                    evidence: [p.reportRef, comparedRef, covering],
                    duplicateOf: review.compared_test,
                    gates: [
                        p.schemaGate,
                        p.leakGate,
                        {gate: 'duplicate', result: 'fail', evidence: [p.reportRef, comparedRef, covering]},
                    ],
                    outcome: 'rejected_duplicate',
                });
            }
        }

        decisions.sort((a, b) => (a.charter_id < b.charter_id ? -1 : 1));
        ctx.writeJson(
            'selection.json',
            {schema: 'explorer-selection/v1', feature_id: feature.id, decisions},
            'orch#selection',
        );
        const accepted = decisions.filter((d) => d.decision === 'accepted').length;
        return {result: 'pass', reason: `${accepted} accepted, ${decisions.length - accepted} rejected`};
    },
};

function accept(ctx, decisions, item, coverage, reviewed) {
    const file = `charters/${slug(item.id)}.json`;
    ctx.writeJson(file, item.charter, 'charter');
    decisions.push({
        charter_id: item.charterId,
        decision: 'accepted',
        leakage: 'pass',
        coverage_verdict: coverage,
        reviewed,
        evidence: [item.reportRef],
        charter_file: ctx.stageRel(file),
    });
}
