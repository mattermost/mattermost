// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Hand-written Playwright JSON report fixtures (shape of `playwright test --reporter=json`), built from small
// builders so each rejection case differs from the good case by one deliberate defect.

export const SOFT_CALL = "expect.soft(info).toContainText('Release purpose bravo-91d2')";
export const SOFT_FRAGMENTS = [
    'expect(locator).toContainText(expected) failed',
    'Expected substring: "Release purpose bravo-91d2"',
];

function frame(call) {
    return `  48 |         await expect(info).toBeVisible(); // declared (x)\n> 49 |         await ${call}; // declared (x)\n     |                ^`;
}

export function assertionError(call = SOFT_CALL, fragments = SOFT_FRAGMENTS) {
    return {
        message: `Error: ${fragments[0]}\n\n${fragments.slice(1).join('\n')}\n\nTimeout: 10000ms`,
        snippet: frame(call),
        location: {file: 'f.spec.ts', line: 49, column: 16},
    };
}

export function passingTest(title = 'PILOT-02 other test') {
    return {
        title,
        test: {expectedStatus: 'passed', status: 'expected', results: [{status: 'passed', retry: 0, errors: []}]},
    };
}

export function failingTest(title = 'PILOT-01 control target', overrides = {}) {
    const errors = overrides.errors ?? [assertionError()];
    return {
        title,
        test: {
            expectedStatus: 'passed',
            status: overrides.status ?? 'unexpected',
            results: overrides.results ?? [{status: 'failed', retry: 0, errors, steps: overrides.steps}],
        },
    };
}

export function mkReport(tests, {retries = 0, errors = [], stats} = {}) {
    const count = (status) => tests.filter((t) => t.test.status === status).length;
    return {
        config: {projects: [{name: 'chrome', retries}], workers: 1},
        suites: [
            {
                title: 'f.spec.ts',
                file: 'f.spec.ts',
                specs: tests.map((t) => ({title: t.title, file: 'f.spec.ts', tests: [t.test]})),
            },
        ],
        errors,
        stats: stats ?? {
            expected: count('expected'),
            unexpected: count('unexpected'),
            flaky: count('flaky'),
            skipped: count('skipped'),
        },
    };
}

export const CONTROL_EXPECTATION = {
    mode: 'control-fail',
    expected_test: 'PILOT-01',
    expected_failing_assertion_text: SOFT_CALL,
    expected_message_fragments: ['Expected substring: "Release purpose bravo-91d2"'],
    must_pass_tests: ['PILOT-02'],
};

export const PASS_EXPECTATION = {mode: 'pass', expected_test: 'PILOT-02', must_pass_tests: ['PILOT-02']};

const goodControl = () => mkReport([failingTest(), passingTest()]);

// Each case: reports to judge, expectation, wanted status, and rule ids that must appear in the evidence.
export const JUDGE_CASES = [
    {
        name: 'good: pass report',
        reports: [mkReport([passingTest()])],
        expectation: PASS_EXPECTATION,
        want: 'pass',
        rules: [],
    },
    {
        name: 'good: control fails at the named assertion',
        reports: [goodControl()],
        expectation: CONTROL_EXPECTATION,
        want: 'pass',
        rules: [],
    },
    {
        name: 'good: control assertion call differs only by spacing and a trailing comment',
        reports: [
            mkReport([
                failingTest('PILOT-01 control target', {
                    errors: [assertionError("expect.soft( info ).toContainText( 'Release purpose bravo-91d2' )")],
                }),
                passingTest(),
            ]),
        ],
        expectation: CONTROL_EXPECTATION,
        want: 'pass',
        rules: [],
    },
    {
        name: 'reject: Test timeout (timedOut, no code frame)',
        reports: [
            mkReport([
                failingTest('PILOT-01 control target', {
                    results: [
                        {status: 'timedOut', retry: 0, errors: [{message: 'Error: Test timeout of 60000ms exceeded.'}]},
                    ],
                }),
                passingTest(),
            ]),
        ],
        expectation: CONTROL_EXPECTATION,
        want: 'fail',
        rules: ['timed_out', 'test_timeout', 'control_did_not_fail'],
    },
    {
        name: 'reject: pass report with a timed out test',
        reports: [
            mkReport([
                {
                    title: 'PILOT-02 other test',
                    test: {
                        status: 'unexpected',
                        results: [
                            {status: 'timedOut', retry: 0, errors: [{message: 'Test timeout of 60000ms exceeded.'}]},
                        ],
                    },
                },
            ]),
        ],
        expectation: PASS_EXPECTATION,
        want: 'fail',
        rules: ['timed_out', 'test_timeout', 'status_mismatch'],
    },
    {
        name: 'reject: interrupted',
        reports: [
            mkReport([
                {
                    title: 'PILOT-02 other test',
                    test: {status: 'unexpected', results: [{status: 'interrupted', retry: 0, errors: []}]},
                },
            ]),
        ],
        expectation: PASS_EXPECTATION,
        want: 'fail',
        rules: ['interrupted', 'status_mismatch'],
    },
    {
        name: 'reject: skipped test',
        reports: [
            mkReport([
                {
                    title: 'PILOT-02 other test',
                    test: {status: 'skipped', results: [{status: 'skipped', retry: 0, errors: []}]},
                },
            ]),
        ],
        expectation: PASS_EXPECTATION,
        want: 'fail',
        rules: ['skipped', 'status_mismatch'],
    },
    {
        name: 'reject: flaky (passed on retry)',
        reports: [
            mkReport(
                [
                    {
                        title: 'PILOT-02 other test',
                        test: {
                            status: 'flaky',
                            results: [
                                {status: 'failed', retry: 0, errors: [assertionError()]},
                                {status: 'passed', retry: 1, errors: []},
                            ],
                        },
                    },
                ],
                {retries: 1},
            ),
        ],
        expectation: PASS_EXPECTATION,
        want: 'fail',
        rules: ['flaky', 'retried', 'retries_configured', 'status_mismatch'],
    },
    {
        name: 'reject: status mismatch, control passed instead of failing',
        reports: [mkReport([passingTest('PILOT-01 control target'), passingTest()])],
        expectation: CONTROL_EXPECTATION,
        want: 'fail',
        rules: ['control_did_not_fail'],
    },
    {
        name: 'reject: pass report holding a failed test',
        reports: [mkReport([failingTest('PILOT-02 other test')])],
        expectation: PASS_EXPECTATION,
        want: 'fail',
        rules: ['status_mismatch'],
    },
    {
        name: 'reject: error recorded in a hook step',
        reports: [
            mkReport([
                failingTest('PILOT-01 control target', {
                    steps: [
                        {title: 'After Hooks', steps: [{title: 'afterEach hook', error: {message: 'Error: closing'}}]},
                    ],
                }),
                passingTest(),
            ]),
        ],
        expectation: CONTROL_EXPECTATION,
        want: 'fail',
        rules: ['hook_or_fixture_error'],
    },
    {
        name: 'reject: fixture error in the message',
        reports: [
            mkReport([
                passingTest('PILOT-01 control target'),
                {
                    title: 'PILOT-02 other test',
                    test: {
                        status: 'unexpected',
                        results: [
                            {status: 'failed', retry: 0, errors: [{message: 'Error: Fixture "pw" setup failed'}]},
                        ],
                    },
                },
            ]),
        ],
        expectation: PASS_EXPECTATION,
        want: 'fail',
        rules: ['fixture_error'],
    },
    {
        name: 'reject: Network guard violations after the expected failure (second error)',
        reports: [
            mkReport([
                failingTest('PILOT-01 control target', {
                    errors: [
                        assertionError(),
                        {
                            message: 'Error: Network guard violations: 1 request(s) left the allowed origin',
                            snippet: frame('closeGuardedSessions()'),
                        },
                    ],
                }),
                passingTest(),
            ]),
        ],
        expectation: CONTROL_EXPECTATION,
        want: 'fail',
        rules: ['guard_violation', 'extra_errors'],
    },
    {
        name: 'reject: error raised in a helper outside the spec file (afterEach / fixture code)',
        reports: [
            mkReport([
                failingTest('PILOT-01 control target', {
                    errors: [
                        {
                            message: 'Error: closing the guarded session failed',
                            location: {file: '/work/explorer-proto/src/session.ts', line: 90, column: 3},
                        },
                    ],
                }),
                passingTest(),
            ]),
        ],
        expectation: CONTROL_EXPECTATION,
        want: 'fail',
        rules: ['error_outside_spec', 'location_less'],
    },
    {
        name: 'reject: closed page error',
        reports: [
            mkReport([
                passingTest('PILOT-01 control target'),
                {
                    title: 'PILOT-02 other test',
                    test: {
                        status: 'unexpected',
                        results: [
                            {
                                status: 'failed',
                                retry: 0,
                                errors: [{message: 'Error: Target page, context or browser has been closed'}],
                            },
                        ],
                    },
                },
            ]),
        ],
        expectation: PASS_EXPECTATION,
        want: 'fail',
        rules: ['page_closed'],
    },
    {
        name: 'reject: control failed at a different assertion',
        reports: [
            mkReport([
                failingTest('PILOT-01 control target', {
                    errors: [assertionError('expect(info).toBeVisible()', ['expect(locator).toBeVisible() failed'])],
                }),
                passingTest(),
            ]),
        ],
        expectation: CONTROL_EXPECTATION,
        want: 'fail',
        rules: ['wrong_assertion', 'message_fragment_missing'],
    },
    {
        name: 'reject: control failed with two errors',
        reports: [
            mkReport([
                failingTest('PILOT-01 control target', {errors: [assertionError(), assertionError()]}),
                passingTest(),
            ]),
        ],
        expectation: CONTROL_EXPECTATION,
        want: 'fail',
        rules: ['extra_errors'],
    },
    {
        name: 'reject: control message fragment missing',
        reports: [
            mkReport([
                failingTest('PILOT-01 control target', {
                    errors: [assertionError(SOFT_CALL, ['expect(locator).toContainText(expected) failed'])],
                }),
                passingTest(),
            ]),
        ],
        expectation: CONTROL_EXPECTATION,
        want: 'fail',
        rules: ['message_fragment_missing'],
    },
    {
        name: 'reject: other test fails during the control',
        reports: [mkReport([failingTest(), failingTest('PILOT-02 other test')])],
        expectation: CONTROL_EXPECTATION,
        want: 'fail',
        rules: ['must_pass_failed', 'unexpected_failure'],
    },
    {
        name: 'reject: pass report produced with retries configured',
        reports: [mkReport([passingTest()], {retries: 2})],
        expectation: PASS_EXPECTATION,
        want: 'fail',
        rules: ['retries_configured'],
    },
    {
        name: 'reject: a pass that ran twice (result retry)',
        reports: [
            mkReport([
                {
                    title: 'PILOT-02 other test',
                    test: {
                        status: 'expected',
                        results: [
                            {status: 'passed', retry: 0, errors: []},
                            {status: 'passed', retry: 1, errors: []},
                        ],
                    },
                },
            ]),
        ],
        expectation: PASS_EXPECTATION,
        want: 'fail',
        rules: ['retried', 'status_mismatch'],
    },
    {
        name: 'reject: global report error',
        reports: [mkReport([passingTest()], {errors: [{message: 'Error: globalSetup failed'}]})],
        expectation: PASS_EXPECTATION,
        want: 'fail',
        rules: ['report_errors'],
    },
    {
        name: 'reject: stats disagree with the tests found',
        reports: [mkReport([passingTest()], {stats: {expected: 2, unexpected: 0, flaky: 0, skipped: 0}})],
        expectation: PASS_EXPECTATION,
        want: 'fail',
        rules: ['stats_mismatch'],
    },
    {
        name: 'reject: no tests in the report',
        reports: [mkReport([])],
        expectation: {mode: 'pass'},
        want: 'fail',
        rules: ['no_tests'],
    },
    {
        name: 'reject: expected test absent from a pass report',
        reports: [mkReport([passingTest('PILOT-09 something else')])],
        expectation: PASS_EXPECTATION,
        want: 'fail',
        rules: ['expected_test_missing', 'must_pass_missing'],
    },
    {
        name: 'reject: control target ran twice',
        reports: [goodControl(), goodControl()],
        expectation: CONTROL_EXPECTATION,
        want: 'fail',
        rules: ['expected_test_repeated'],
    },
    {
        name: 'blocked: report is not a Playwright report',
        reports: [{hello: 'world'}],
        expectation: PASS_EXPECTATION,
        want: 'blocked',
        rules: ['report_unreadable'],
    },
    {
        name: 'blocked: no report at all',
        reports: [],
        expectation: PASS_EXPECTATION,
        want: 'blocked',
        rules: ['report_unreadable'],
    },
];
