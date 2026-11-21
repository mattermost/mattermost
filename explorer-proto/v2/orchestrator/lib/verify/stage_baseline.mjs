// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable @stylistic/indent, @stylistic/multiline-ternary, @stylistic/operator-linebreak -- Prettier owns formatting and the repo config relaxes these rules for .ts/.js only */

// S1, baseline: the unchanged spec on the original fixture, retries 0, one worker, judged by replay_judge (pass).
import fs from 'node:fs';

import {checkManifestSession, declaredBookmarks, loadCharter, probeFixture, readManifest} from './fixture.mjs';
import {judgeReport, runReplay, summarizeReport} from './replay.mjs';
import {assertSpecUnchanged, specText, testTitleOf} from './spec.mjs';
import {currentSetup, engineOf} from './support.mjs';

import {engineArgv} from '../engine.mjs';
import {dirDigest} from '../stages/util.mjs';

export default {
    index: 1,
    name: 'baseline',

    inputs(ctx) {
        return [{target: dirDigest(ctx, 0)}, {spec: ctx.flags.verifySpec.sha256}, {session: ctx.flags.session}];
    },

    async run(ctx) {
        const {flags} = ctx;
        const before = assertSpecUnchanged(flags);
        if (!flags.live) {
            return {result: 'skipped', reason: 'skipped: not live (the baseline replay needs the seeded stack)'};
        }
        const engine = engineOf(flags);
        const setup = currentSetup(ctx);
        const declared = declaredBookmarks(loadCharter(flags.session));
        const manifest = readManifest();
        const check = checkManifestSession(manifest, flags.session, declared);
        const probe = check.ok
            ? await probeFixture({manifest, declared, expectedFingerprint: setup.fixture_fingerprint})
            : {ok: false, reason: check.failures[0]};
        if (!probe.ok) {
            return {
                result: 'blocked',
                reason: `the fixture is not the original one before the baseline (${probe.reason})`,
            };
        }

        const title = testTitleOf(specText(flags));
        const run = runReplay(ctx, engine);
        if (!run.report) {
            return {result: 'fail', reason: `the replay wrote no report (exit ${run.exit_code})`};
        }
        const report = JSON.parse(fs.readFileSync(run.report, 'utf8'));
        const summary = summarizeReport(report);
        const judge = judgeReport(run.report, {
            mode: 'pass',
            expected_test: title,
            must_pass_tests: [title],
            expected_executions: 1,
        });
        const after = assertSpecUnchanged(flags);
        const finalProbe = await probeFixture({manifest, declared, expectedFingerprint: setup.fixture_fingerprint});

        const reasons = [];
        if (run.exit_code !== 0) {
            reasons.push(`replay exit ${run.exit_code}`);
        }
        if (judge.status !== 'pass') {
            reasons.push(`judge ${judge.status} (${judge.rules.join(',')})`);
        }
        if (summary.retries_configured !== 0 || summary.workers !== 1) {
            reasons.push('the report was not produced with retries 0 and one worker');
        }
        if (!finalProbe.ok) {
            reasons.push(`the fixture changed during the baseline (${finalProbe.reason})`);
        }
        ctx.writeJson(
            'baseline.json',
            {
                schema: 'explorer-baseline-record/v1',
                session: flags.session,
                test_title: title,
                spec: {path: flags.verifySpec.path, sha256_before: before, sha256_after: after},
                fixture: {
                    fingerprint_before: setup.fixture_fingerprint,
                    fingerprint_after: finalProbe.fingerprint,
                },
                replay: {
                    command: engineArgv('replay', engine),
                    exit_code: run.exit_code,
                    retries: summary.retries_configured,
                    workers: summary.workers,
                    report: summary,
                },
                judge,
                result: reasons.length === 0 ? 'pass' : 'fail',
            },
            'orch#baseline-record',
        );
        return reasons.length === 0
            ? {result: 'pass', reason: `baseline replay passed; judge ${judge.status}`}
            : {result: 'fail', reason: reasons.join('; ')};
    },
};
