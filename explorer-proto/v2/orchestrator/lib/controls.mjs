// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable @stylistic/wrap-regex -- Prettier owns formatting and the repo config relaxes these rules for .ts/.js only */

// Negative controls: a seed change that keeps navigation intact, applied to an already emitted spec (replay only).
// The judge is deterministic: a control passes only when the replay fails at the named assertion and nowhere else.
import fs from 'node:fs';
import path from 'node:path';

import {PROTO_DIR, REPO_ROOT} from './common.mjs';
import {engineArgv} from './engine.mjs';

const ANSI = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, 'g');
const UP = 'explorer-proto/infra/scripts/up.sh';
const DOWN = 'explorer-proto/infra/scripts/down.sh';

function* walkSuite(suite) {
    for (const spec of suite.specs ?? []) {
        for (const test of spec.tests ?? []) {
            for (const result of test.results ?? []) {
                yield {
                    title: spec.title,
                    status: result.status,
                    errors: result.errors ?? (result.error ? [result.error] : []),
                };
            }
        }
    }
    for (const child of suite.suites ?? []) {
        yield* walkSuite(child);
    }
}

function* resultsOf(report) {
    for (const suite of report.suites ?? []) {
        yield* walkSuite(suite);
    }
}

const squash = (text) => text.replace(ANSI, '').replace(/\s+/g, ' ');

/** Judges a Playwright JSON report of a control replay against the expected failing assertion text. */
export function judgeControlReport(report, expectedAssertion) {
    if ((report.errors ?? []).length > 0) {
        return {pass: false, reason: 'report-level errors'};
    }
    const failed = [...resultsOf(report)].filter((r) => r.status !== 'passed' && r.status !== 'skipped');
    const skipped = [...resultsOf(report)].some((r) => r.status === 'skipped');
    if (skipped) {
        return {pass: false, reason: 'a test was skipped'};
    }
    if (failed.length === 0) {
        return {pass: false, reason: 'the replay did not fail'};
    }
    const expected = squash(expectedAssertion);
    for (const r of failed) {
        if (r.status !== 'failed') {
            return {pass: false, reason: `status ${r.status}`};
        }
        if (r.errors.length === 0) {
            return {pass: false, reason: 'failure without an error'};
        }
        for (const error of r.errors) {
            const message = squash(error.message ?? '');
            if (/Test timeout|Network guard violations/.test(message) || !message.includes(expected)) {
                return {pass: false, reason: 'failed somewhere other than the named assertion'};
            }
        }
    }
    return {pass: true, reason: 'failed at the named assertion only'};
}

function reportFile(engine) {
    const name = engine.kind === 'journey' ? 'replay-journey.json' : 'replay.json';
    return path.join(PROTO_DIR, 'sessions', engine.name, 'generated', 'reports', name);
}

function replayOnce(ctx, engine) {
    const done = ctx.exec(engineArgv('replay', engine), {cwd: REPO_ROOT});
    const file = reportFile(engine);
    return {status: done.status, report: fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null};
}

function stackUp(ctx, target, variant, engine) {
    const argv = ['bash', path.join(REPO_ROOT, UP), `--target=${target}`, ...(variant ? [`--variant=${variant}`] : [])];
    if (engine.kind === 'session' && engine.name === 'bookmarks') {
        argv.push('--session=bookmarks');
    }
    return ctx.exec(argv).status === 0;
}

const stackDown = (ctx) => ctx.exec(['bash', path.join(REPO_ROOT, DOWN)]);

/** Control kinds this orchestrator knows how to apply. Anything else is reported blocked, never passed. */
export const APPLIERS = {
    seed_variant(ctx, control, {target, engine}) {
        if (!control.variant || !control.expected_failing_assertion) {
            return 'blocked';
        }
        stackDown(ctx);
        if (!stackUp(ctx, target, control.variant, engine)) {
            return 'blocked';
        }
        const run = replayOnce(ctx, engine);
        stackDown(ctx);
        const judged = run.report ? judgeControlReport(run.report, control.expected_failing_assertion) : {pass: false};
        if (!stackUp(ctx, target, null, engine)) {
            return 'blocked';
        }
        const restored = replayOnce(ctx, engine);
        stackDown(ctx);
        return judged.pass && restored.status === 0 ? 'pass' : 'fail';
    },
};
