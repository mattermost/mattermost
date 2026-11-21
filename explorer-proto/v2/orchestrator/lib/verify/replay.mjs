// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable no-process-env -- the replay command override is a documented test seam; the licence is removed from child environments */

// One replay of the session through the engine CLI (`node explorer-proto/src/cli.ts replay --session=<name>`), judged by
// the frozen replay_judge gate. Console output of the replay is discarded: only the JSON report is read.
import fs from 'node:fs';
import path from 'node:path';

import {judge} from '../../../gates/replay_judge.mjs';
import {splitCommand} from '../agents.mjs';
import {PROTO_DIR, REPO_ROOT} from '../common.mjs';
import {engineArgv} from '../engine.mjs';

export function withoutLicence(env = process.env) {
    const copy = {...env};
    delete copy.MM_LICENSE;
    return copy;
}

export function replayReportPath(engine) {
    return process.env.PILOT_REPLAY_REPORT
        ? path.resolve(process.env.PILOT_REPLAY_REPORT)
        : path.join(PROTO_DIR, 'sessions', engine.name, 'generated', 'reports', 'replay.json');
}

export function replayArgv(engine) {
    return process.env.PILOT_REPLAY_CMD ? splitCommand(process.env.PILOT_REPLAY_CMD) : engineArgv('replay', engine);
}

/** Runs one replay with retries 0 and one worker (both fixed by explorer-proto/playwright.config.ts). */
export function runReplay(ctx, engine) {
    const report = replayReportPath(engine);
    fs.rmSync(report, {force: true});
    const done = ctx.exec(replayArgv(engine), {cwd: REPO_ROOT, env: withoutLicence(), quiet: true});
    return {exit_code: done.status, report: fs.existsSync(report) ? report : null};
}

/** The deterministic part of a report: counts, configured retries and workers, per-test status. No times, no messages. */
export function summarizeReport(report) {
    const tests = [];
    const walk = (suite) => {
        for (const spec of suite.specs ?? []) {
            for (const test of spec.tests ?? []) {
                tests.push({
                    title: String(spec.title ?? ''),
                    status: test.status,
                    results: (test.results ?? []).map((r) => r.status),
                });
            }
        }
        (suite.suites ?? []).forEach(walk);
    };
    (report.suites ?? []).forEach(walk);
    const projects = report.config?.projects ?? [];
    return {
        stats: {
            expected: report.stats?.expected ?? 0,
            unexpected: report.stats?.unexpected ?? 0,
            flaky: report.stats?.flaky ?? 0,
            skipped: report.stats?.skipped ?? 0,
        },
        retries_configured: Math.max(
            0,
            ...projects.map((p) => Number(p.retries) || 0),
            Number(report.config?.retries) || 0,
        ),
        workers: Number(report.config?.workers ?? 0),
        tests,
    };
}

/** Judges one report with replay_judge; the evidence keeps rule ids only. */
export function judgeReport(reportPath, expectation) {
    const verdict = judge({reports: [reportPath], expectation});
    return {
        status: verdict.status,
        observed: verdict.observed,
        rules: [...new Set(verdict.evidence.map((e) => e.rule))].sort(),
        counts: {
            reports: verdict.counts.reports ?? 0,
            tests: verdict.counts.tests ?? 0,
            passed: verdict.counts.passed ?? 0,
        },
    };
}
