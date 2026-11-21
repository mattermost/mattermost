#!/usr/bin/env node
// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Gate `replay_judge`: strict judgement of Playwright JSON reports against an expectation file.
// Generalises the judge in explorer-proto/run-pilot.sh (JUDGE_JS) into a standalone module.
//
// Expectation: {mode: 'pass'|'control-fail', expected_test, expected_failing_assertion_text,
//               expected_message_fragments[], must_pass_tests[], expected_executions?}
// Interface: gate.run({reports: [path|object], expectation}) -> {status, evidence, observed, counts}.
// CLI: replay_judge.mjs --expect <expectation.json> <report.json>...   |   replay_judge.mjs --selftest
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

import {
    UsageError,
    exitCodeFor,
    guarded,
    looksLikePlaywrightReport,
    maskFirstLine,
    parseArgs,
    printJson,
    readJsonFile,
    resultErrors,
    runCli,
    stripAnsi,
    walkReport,
} from './common.mjs';

const FORBIDDEN_MESSAGES = [
    [/Test timeout/i, 'test_timeout'],
    [/Network guard violations/i, 'guard_violation'],
    [/route handler (?:error|failed)/i, 'route_handler_error'],
    [/Target page, context or browser has been closed|Target closed|page has been closed/i, 'page_closed'],
    [/\b(?:beforeEach|afterEach|beforeAll|afterAll)\b/, 'hook_error'],
    [/\bfixture\b/i, 'fixture_error'],
];
const HOOK_STEP = /hook|fixture/i;

export function normalizeCall(text) {
    return String(text ?? '')
        .trim()
        .replace(/^await\s+/, '')
        .replace(/;\s*(?:\/\/.*)?$/, '')
        .replace(/\s+/g, ' ')
        .replace(/([({])\s+/g, '$1')
        .replace(/\s+([)}])/g, '$1')
        .trim();
}

function codeFrame(error) {
    const marked = stripAnsi(error.snippet)
        .split('\n')
        .find((line) => /^>\s*\d+\s*\|/.test(line));
    return marked ? marked.replace(/^>\s*\d+\s*\|/, '').trim() : '';
}

// This Playwright version's JSON error holds {message, location} and no snippet: the call is read from the source line.
function sourceLine(error) {
    const {file, line} = error.location ?? {};
    if (!file || !Number.isInteger(line) || !fs.existsSync(file)) {
        return '';
    }
    return fs.readFileSync(file, 'utf8').split('\n')[line - 1] ?? '';
}

const toPosix = (p) => String(p).replace(/\\/g, '/');

function errorsOf(test, specFile = '') {
    const out = [];
    for (const result of test.results ?? []) {
        for (const e of resultErrors(result)) {
            const message = stripAnsi(e.message);
            const call = normalizeCall(codeFrame(e) || sourceLine(e));
            const outside = Boolean(
                specFile && e.location?.file && !toPosix(e.location.file).endsWith(toPosix(specFile)),
            );
            out.push({message, first: maskFirstLine(message), call, outside});
        }
    }
    return out;
}

function failingSteps(steps, inHook = false) {
    let found = 0;
    for (const step of steps ?? []) {
        const hook = inHook || HOOK_STEP.test(step.title ?? '');
        if (step.error && hook) {
            found++;
        }
        found += failingSteps(step.steps, hook);
    }
    return found;
}

function titleMatches(title, id) {
    return title === id || title.startsWith(`${id} `) || title.startsWith(`${id}:`);
}

const passedRun = (test) =>
    test.status === 'expected' &&
    (test.results ?? []).length === 1 &&
    test.results.every((r) => r.status === 'passed' && !(r.errors?.length || r.error));

export function validateExpectation(expectation) {
    const bad = (why) => {
        throw new UsageError(`invalid expectation: ${why}`);
    };
    if (!expectation || typeof expectation !== 'object') {
        bad('not an object');
    }
    if (expectation.mode !== 'pass' && expectation.mode !== 'control-fail') {
        bad('mode must be pass or control-fail');
    }
    const strings = (v) => Array.isArray(v) && v.every((s) => typeof s === 'string' && s.length > 0);
    if (expectation.must_pass_tests !== undefined && !strings(expectation.must_pass_tests)) {
        bad('must_pass_tests must be a list of test titles');
    }
    if (expectation.mode === 'control-fail') {
        if (typeof expectation.expected_test !== 'string' || !expectation.expected_test) {
            bad('control-fail needs expected_test');
        }
        if (
            typeof expectation.expected_failing_assertion_text !== 'string' ||
            !expectation.expected_failing_assertion_text
        ) {
            bad('control-fail needs expected_failing_assertion_text');
        }
        if (!strings(expectation.expected_message_fragments ?? [])) {
            bad('expected_message_fragments must be a list of strings');
        }
    }
    if (
        expectation.mode === 'pass' &&
        expectation.expected_test !== undefined &&
        typeof expectation.expected_test !== 'string'
    ) {
        bad('expected_test must be a string');
    }
    if (expectation.expected_executions !== undefined && !Number.isInteger(expectation.expected_executions)) {
        bad('expected_executions must be an integer');
    }
    return expectation;
}

function loadReports(inputs) {
    return inputs.map((input) => {
        if (typeof input !== 'string') {
            return {name: 'inline', report: input};
        }
        return {name: path.basename(input), report: readJsonFile(input)};
    });
}

export function judge({reports: inputs, expectation: rawExpectation}) {
    const expectation = validateExpectation(rawExpectation);
    if (!Array.isArray(inputs) || inputs.length === 0) {
        return {
            status: 'blocked',
            observed: 'invalid',
            evidence: [{rule: 'report_unreadable', detail: 'no report given'}],
            counts: {},
        };
    }
    let loaded;
    try {
        loaded = loadReports(inputs);
    } catch (error) {
        if (error instanceof UsageError) {
            return {
                status: 'blocked',
                observed: 'invalid',
                evidence: [{rule: 'report_unreadable', detail: error.message}],
                counts: {},
            };
        }
        throw error;
    }
    const unreadable = loaded.filter((r) => !looksLikePlaywrightReport(r.report));
    if (unreadable.length > 0) {
        return {
            status: 'blocked',
            observed: 'invalid',
            evidence: unreadable.map((r) => ({
                rule: 'report_unreadable',
                detail: `${r.name} is not a Playwright JSON report`,
            })),
            counts: {},
        };
    }

    const problems = [];
    const problem = (rule, test, detail) => problems.push({rule, ...(test ? {test} : {}), ...(detail ? {detail} : {})});
    const runs = [];

    for (const {name, report} of loaded) {
        const tests = walkReport(report);
        if (!Array.isArray(report.errors) && report.errors !== undefined) {
            problem('report_errors', undefined, `${name}: errors is not a list`);
        }
        if ((report.errors ?? []).length > 0) {
            problem('report_errors', undefined, `${name}: ${maskFirstLine(report.errors[0]?.message)}`);
        }
        if ((report.config?.projects ?? []).some((p) => Number(p.retries) > 0) || Number(report.config?.retries) > 0) {
            problem('retries_configured', undefined, `${name}: report was produced with retries > 0`);
        }
        const stats = report.stats;
        if (stats) {
            const total = ['expected', 'unexpected', 'flaky', 'skipped'].reduce(
                (sum, k) => sum + Number(stats[k] ?? 0),
                0,
            );
            if (total !== tests.length) {
                problem('stats_mismatch', undefined, `${name}: stats count ${total}, tests found ${tests.length}`);
            }
            if (Number(stats.flaky) > 0) {
                problem('flaky', undefined, `${name}: stats report flaky tests`);
            }
            if (Number(stats.skipped) > 0) {
                problem('skipped', undefined, `${name}: stats report skipped tests`);
            }
        }
        for (const t of tests) {
            runs.push({...t, report: name});
        }
    }

    for (const run of runs) {
        const {title, test} = run;
        const statuses = (test.results ?? []).map((r) => r.status);
        if (statuses.includes('timedOut')) {
            problem('timed_out', title, 'a result timed out');
        }
        if (statuses.includes('interrupted')) {
            problem('interrupted', title, 'a result was interrupted');
        }
        if (test.status === 'skipped' || statuses.includes('skipped')) {
            problem('skipped', title, 'the test was skipped');
        }
        if (test.status === 'flaky') {
            problem('flaky', title, 'the test passed only after a retry');
        }
        if ((test.results ?? []).length > 1 || (test.results ?? []).some((r) => Number(r.retry) > 0)) {
            problem('retried', title, 'the test ran more than once');
        }
        if ((test.results ?? []).length === 0) {
            problem('no_result', title, 'the test has no result');
        }
        if ((test.results ?? []).some((r) => failingSteps(r.steps) > 0)) {
            problem('hook_or_fixture_error', title, 'a hook or fixture step recorded an error');
        }
        for (const e of errorsOf(test, run.file)) {
            if (e.outside) {
                problem(
                    'error_outside_spec',
                    title,
                    'an error was raised outside the spec file (hook, fixture or helper)',
                );
            }
            for (const [re, rule] of FORBIDDEN_MESSAGES) {
                if (re.test(e.message)) {
                    problem(rule, title, e.first);
                }
            }
        }
    }

    const matching = (id) => runs.filter((r) => titleMatches(r.title, id));
    if (runs.length === 0) {
        problem('no_tests', undefined, 'the reports contain no test executions');
    }
    if (expectation.expected_executions !== undefined && runs.length !== expectation.expected_executions) {
        problem('execution_count', undefined, `${runs.length} executions, expected ${expectation.expected_executions}`);
    }
    for (const id of expectation.must_pass_tests ?? []) {
        const found = matching(id);
        if (found.length === 0) {
            problem('must_pass_missing', id, 'no execution of this test in the reports');
        } else if (!found.every((r) => passedRun(r.test))) {
            problem('must_pass_failed', id, 'a required test did not pass cleanly');
        }
    }

    let observed = 'invalid';
    if (expectation.mode === 'pass') {
        if (expectation.expected_test !== undefined && matching(expectation.expected_test).length === 0) {
            problem('expected_test_missing', expectation.expected_test, 'no execution of the expected test');
        }
        for (const run of runs.filter((r) => !passedRun(r.test))) {
            const first = errorsOf(run.test, run.file)[0];
            problem(
                'status_mismatch',
                run.title,
                `status ${run.test.status}${first ? `: ${first.call || '(no code frame)'}: ${first.first}` : ''}`,
            );
        }
        observed = runs.length > 0 && runs.every((r) => passedRun(r.test)) ? 'pass' : 'invalid';
    } else {
        observed = judgeControl(expectation, runs, matching, problem);
    }

    const counts = {
        reports: loaded.length,
        tests: runs.length,
        passed: runs.filter((r) => passedRun(r.test)).length,
    };
    return {
        status: problems.length === 0 ? 'pass' : 'fail',
        observed: problems.length === 0 ? observed : 'invalid',
        evidence: problems,
        counts,
    };
}

function judgeControl(expectation, runs, matching, problem) {
    const id = expectation.expected_test;
    const target = matching(id);
    if (target.length === 0) {
        problem('expected_test_missing', id, 'no execution of the expected test');
        return 'invalid';
    }
    if (target.length > 1) {
        problem('expected_test_repeated', id, `${target.length} executions, expected exactly 1`);
        return 'invalid';
    }
    const {test} = target[0];
    const results = test.results ?? [];
    if (test.status !== 'unexpected' || results.length !== 1 || results[0].status !== 'failed') {
        problem(
            'control_did_not_fail',
            id,
            `test status ${test.status}, results ${results.map((r) => r.status).join(',') || 'none'}`,
        );
        return 'invalid';
    }
    const errors = errorsOf(test, target[0].file);
    if (errors.length === 0) {
        problem('no_error', id, 'the failing test recorded no error');
        return 'invalid';
    }
    if (errors.length > 1) {
        problem('extra_errors', id, `${errors.length} errors recorded, expected exactly 1`);
    }
    const [first] = errors;
    if (first.call === '') {
        problem('location_less', id, `failure has no code frame: ${first.first}`);
    } else if (first.call !== normalizeCall(expectation.expected_failing_assertion_text)) {
        problem('wrong_assertion', id, `failed at ${first.call}`);
    }
    (expectation.expected_message_fragments ?? []).forEach((fragment, index) => {
        if (!first.message.includes(fragment)) {
            problem('message_fragment_missing', id, `fragment ${index + 1} not found in the failure message`);
        }
    });
    for (const run of runs.filter((r) => r !== target[0] && !passedRun(r.test))) {
        problem('unexpected_failure', run.title, `status ${run.test.status}`);
    }
    return 'control-fail';
}

export const gate = {
    id: 'replay_judge',
    run(ctx = {}) {
        return guarded(() => {
            const {status, evidence, observed, counts} = judge({reports: ctx.reports, expectation: ctx.expectation});
            return {status, evidence, observed, counts};
        });
    },
};

async function main() {
    const {positional, values} = parseArgs(process.argv.slice(2), {flags: ['selftest'], options: ['expect']});
    if (values.selftest) {
        const {runSelftest} = await import('./replay_judge.selftest.mjs');
        return runSelftest();
    }
    if (!values.expect || positional.length === 0) {
        throw new UsageError('usage: replay_judge.mjs --expect <expectation.json> <report.json>...  |  --selftest');
    }
    const result = judge({reports: positional, expectation: readJsonFile(values.expect)});
    printJson(result);
    return exitCodeFor(result.status);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    runCli(main);
}
