// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable @stylistic/indent, @stylistic/multiline-ternary, @stylistic/operator-linebreak, no-process-env -- Prettier owns formatting and the repo config relaxes these rules for .ts/.js only; MM_LICENSE is removed from the environment of the control's commands */

// S2, control failure: the frozen mutation_control gate applies the verification control (owner PATCH of one bookmark
// title), the unchanged spec is replayed and judged control-fail at the named assertion, and the fixture is restored
// and re-checked before anything is handed to a verifier. The sanitized failure trace is written here.
import fs from 'node:fs';
import path from 'node:path';

import {buildPlan, loadControl} from './control_def.mjs';
import {checkManifestSession, declaredBookmarks, probeFixture, readManifest} from './fixture.mjs';
import {judgeReport, runReplay, summarizeReport} from './replay.mjs';
import {assertSpecUnchanged, locateAssertion, specText, testTitleOf} from './spec.mjs';
import {currentSetup, engineOf, leakScan} from './support.mjs';
import {failureEvidence, scrub, unsafeFindings} from './trace.mjs';

import {runControl} from '../../../gates/mutation_control.mjs';
import {PROTO_DIR} from '../common.mjs';
import {engineArgv} from '../engine.mjs';
import {dirDigest} from '../stages/util.mjs';

const restoreInstruction = (declaredTitle) =>
    `As the seeding admin (the bookmark owner), patch that bookmark back to the declared title "${declaredTitle}" with the owner-patch command, read it back, and confirm the bookmark id is unchanged.`;

async function seedCheck(flags, setup, declared) {
    const manifest = readManifest();
    const manifestCheck = checkManifestSession(manifest, flags.session, declared);
    if (!manifestCheck.ok) {
        return {result: 'fail', manifest_session: false, titles_declared: false, fingerprint_equal: false};
    }
    const probe = await probeFixture({manifest, declared, expectedFingerprint: setup.fixture_fingerprint});
    return {
        result: probe.ok ? 'pass' : 'fail',
        manifest_session: true,
        titles_declared: probe.ok || probe.reason === 'fingerprint_differs',
        fingerprint_equal: probe.ok,
    };
}

async function withoutLicence(body) {
    const saved = process.env.MM_LICENSE;
    delete process.env.MM_LICENSE;
    try {
        return await body();
    } finally {
        if (saved !== undefined) {
            process.env.MM_LICENSE = saved;
        }
    }
}

export default {
    index: 2,
    name: 'control',

    inputs(ctx) {
        return [
            {target: dirDigest(ctx, 0)},
            {baseline: dirDigest(ctx, 1)},
            {spec: ctx.flags.verifySpec.sha256},
            {control: ctx.flags.control.sha256},
        ];
    },

    async run(ctx) {
        const {flags} = ctx;
        const before = assertSpecUnchanged(flags);
        if (!flags.live) {
            return {result: 'skipped', reason: 'skipped: not live (the control needs the seeded stack)'};
        }
        const engine = engineOf(flags);
        const setup = currentSetup(ctx);
        const control = loadControl(flags.control.id, flags.session);
        const declared = declaredBookmarks(control.charter);
        const text = specText(flags);
        const title = testTitleOf(text);
        const located = locateAssertion(text, control.entry.expected_failing_assertion);
        const fragments = [...(located.matcher ? [`expect(locator).${located.matcher}() failed`] : []), located.name];
        const expectation = {
            mode: 'control-fail',
            expected_test: title,
            expected_failing_assertion_text: located.call,
            expected_message_fragments: fragments,
            must_pass_tests: [],
            expected_executions: 1,
        };
        const plan = buildPlan({control, expectation});

        let replay = null;
        const outcome = await withoutLicence(() =>
            runControl(plan, {
                runSpec: async () => {
                    replay = runReplay(ctx, engine);
                    return {reports: replay.report ? [replay.report] : [], exit_code: replay.exit_code};
                },
            }),
        );

        let judge = null;
        let evidence = null;
        let reportSummary = null;
        if (replay?.report) {
            const report = JSON.parse(fs.readFileSync(replay.report, 'utf8'));
            reportSummary = summarizeReport(report);
            judge = judgeReport(replay.report, expectation);
            evidence = failureEvidence({
                report,
                title,
                resultsRoot: path.join(PROTO_DIR, 'sessions', engine.name, 'generated', 'test-results'),
                titles: [control.declaredTitle, control.def.changed_title, ...declared.map((d) => d.display_name)],
            });
        }

        const seed = await seedCheck(flags, setup, declared);
        let restored = null;
        if (outcome.status !== 'blocked' && seed.result === 'pass') {
            const run = runReplay(ctx, engine);
            restored = {
                exit_code: run.exit_code,
                judge: run.report
                    ? judgeReport(run.report, {
                          mode: 'pass',
                          expected_test: title,
                          must_pass_tests: [title],
                          expected_executions: 1,
                      })
                    : null,
            };
        }
        const after = assertSpecUnchanged(flags);

        const failures = [];
        if (outcome.status !== 'pass') {
            failures.push(
                `mutation_control ${outcome.status}${outcome.blocked_reason ? ` (${outcome.blocked_reason})` : ''}`,
            );
        }
        if (judge && (judge.status !== 'pass' || judge.observed !== 'control-fail')) {
            failures.push(`judge ${judge.status}/${judge.observed} (${judge.rules.join(',')})`);
        }
        if (judge && located.line !== evidence?.line) {
            failures.push('the failure is not at the line the charter names');
        }
        if (evidence && evidence.bookmark_bar.length === 0) {
            failures.push('the error-context.md snapshot holds no bookmark-bar part');
        }
        if (evidence && evidence.error_count !== 1) {
            failures.push(`${evidence.error_count} errors recorded, expected exactly 1`);
        }
        if (seed.result !== 'pass') {
            failures.push('the restored fixture does not match the original seed');
        }
        if (!restored || restored.exit_code !== 0 || restored.judge?.status !== 'pass') {
            failures.push('the replay on the restored fixture did not pass');
        }

        let trace = null;
        let traceFile = null;
        if (judge?.status === 'pass' && evidence) {
            trace = {
                schema: 'explorer-failure-trace/v1',
                label: control.def.label,
                spec: {path: flags.verifySpec.path, sha256: before},
                test_title: title,
                failing: {
                    line: located.line,
                    expect_call: scrub(located.call),
                    matcher: located.matcher,
                    predicate: located.predicate,
                },
                message: evidence.message,
                message_first_line: evidence.message_first_line,
                error_count: evidence.error_count,
                bookmark_bar_snapshot: evidence.bookmark_bar,
                judge,
                mutation: {
                    label: control.def.label,
                    control_id: control.def.id,
                    description: `Owner PATCH of the control's bookmark (its channel key is in the task's control section): display_name changed from "${control.declaredTitle}" to "${control.def.changed_title}". Type, link target, channel, membership and sidebar names are unchanged; the bookmark keeps its id.`,
                    declared_title: control.declaredTitle,
                    changed_title: control.def.changed_title,
                },
                restore: restoreInstruction(control.declaredTitle),
            };
            traceFile = 'failure-trace.json';
            ctx.writeJson(traceFile, trace, 'orch#failure-trace');
        }
        const traceFindings = trace ? unsafeFindings(fs.readFileSync(path.join(ctx.dir, traceFile), 'utf8')) : [];
        if (trace && traceFindings.length > 0) {
            failures.push(`the failure trace did not pass the unsafe-text scan (${traceFindings.join(', ')})`);
        }
        const scan = trace ? leakScan([path.join(ctx.dir, traceFile)]) : null;
        if (scan && (scan.unsafe_text !== 'PASS' || scan.licence === 'FAIL')) {
            failures.push('the failure trace did not pass the leak scan');
        }
        if (!trace && failures.length === 0) {
            failures.push('no failure trace could be captured');
        }

        const states = outcome.states.map((s) => ({
            state: s.state,
            result: s.result,
            ...(s.detail ? {detail: s.detail} : {}),
        }));
        let finalResult = 'fail';
        if (failures.length === 0) {
            finalResult = 'pass';
        } else if (outcome.status === 'blocked' && seed.result === 'pass') {
            finalResult = 'blocked';
        }
        ctx.writeJson(
            'control.json',
            {
                schema: 'explorer-control-record/v1',
                label: control.def.label,
                control_id: control.def.id,
                control_definition: {file: control.file, sha256: control.sha256},
                session: flags.session,
                spec: {path: flags.verifySpec.path, sha256_before: before, sha256_after: after},
                expectation: {
                    test_title: title,
                    failing_line: located.line,
                    expected_failing_assertion_text: located.call,
                    message_fragments: fragments,
                    expects_up_to_failing: located.expects_up_to_failing.length,
                },
                mutation_control: {
                    status: outcome.status,
                    ...(outcome.blocked_reason ? {blocked_reason: outcome.blocked_reason} : {}),
                    states,
                },
                replay: {
                    command: engineArgv('replay', engine),
                    exit_code: replay?.exit_code ?? null,
                    report: reportSummary,
                },
                judge,
                failure_trace: trace
                    ? {
                          file: traceFile,
                          error_count: trace.error_count,
                          snapshot_lines: trace.bookmark_bar_snapshot.length,
                          leak_scan: scan,
                      }
                    : null,
                restore: {
                    states: states.filter((s) => ['restore', 'verify_restore'].includes(s.state)),
                    seed_check: seed,
                    fixture_fingerprint: setup.fixture_fingerprint,
                    replay: restored,
                },
                result: finalResult,
            },
            'orch#control-record',
        );
        if (failures.length === 0) {
            return {
                result: 'pass',
                reason: 'control failed at the named assertion only; fixture restored and replay passes',
            };
        }
        return {result: finalResult, reason: failures.join('; ')};
    },
};
