// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Self-test for stability_gate.mjs: bad replay sets, trace determinism and Clopper-Pearson values.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {GATES_DIR, readJsonFile} from './common.mjs';
import {failingTest, mkReport, passingTest} from './fixtures/report_fixtures.mjs';
import {
    binomialCdf,
    clopperPearsonLower,
    clopperPearsonUpper,
    estimateFlake,
    runsForZeroFailures,
    stability,
} from './stability_gate.mjs';

const clean = (i, tests = [passingTest('PILOT-01 a'), passingTest('PILOT-02 b')]) => {
    const report = mkReport(tests);
    report.stats.startTime = `run-${i}`;
    return report;
};
const cleanSet = (n = 20) => Array.from({length: n}, (_, i) => clean(i));
const withReplaced = (index, report) => cleanSet().map((r, i) => (i === index ? report : r));

function withTest(testOverrides) {
    return clean(7, [{title: 'PILOT-01 a', test: testOverrides}, passingTest('PILOT-02 b')]);
}

const STABILITY_CASES = [
    {name: '20/20 clean passes', run: () => stability({reports: cleanSet()}), want: 'pass', rules: []},
    {
        name: '19 reports is incomplete evidence (blocked)',
        run: () => stability({reports: cleanSet(19)}),
        want: 'blocked',
        rules: ['replay_count'],
    },
    {
        name: '21 reports is rejected (blocked)',
        run: () => stability({reports: cleanSet(21)}),
        want: 'blocked',
        rules: ['replay_count'],
    },
    {
        name: 'unreadable report (blocked)',
        run: () => stability({reports: withReplaced(3, {nope: true})}),
        want: 'blocked',
        rules: ['report_unreadable'],
    },
    {
        name: 'one failed replay (19/20)',
        run: () =>
            stability({reports: withReplaced(4, clean(4, [failingTest('PILOT-01 a'), passingTest('PILOT-02 b')]))}),
        want: 'fail',
        rules: ['status_mismatch'],
    },
    {
        name: 'one flaky replay',
        run: () =>
            stability({
                reports: withReplaced(
                    5,
                    withTest({
                        status: 'flaky',
                        results: [
                            {status: 'failed', retry: 0, errors: []},
                            {status: 'passed', retry: 1, errors: []},
                        ],
                    }),
                ),
            }),
        want: 'fail',
        rules: ['flaky', 'retried'],
    },
    {
        name: 'one skipped replay',
        run: () =>
            stability({
                reports: withReplaced(
                    6,
                    withTest({status: 'skipped', results: [{status: 'skipped', retry: 0, errors: []}]}),
                ),
            }),
        want: 'fail',
        rules: ['skipped'],
    },
    {
        name: 'one timed out replay',
        run: () =>
            stability({
                reports: withReplaced(
                    8,
                    withTest({
                        status: 'unexpected',
                        results: [
                            {status: 'timedOut', retry: 0, errors: [{message: 'Test timeout of 60000ms exceeded.'}]},
                        ],
                    }),
                ),
            }),
        want: 'fail',
        rules: ['timed_out', 'log_test_timeout'],
    },
    {
        name: 'a report copied twice (not a fresh fixture)',
        run: () => stability({reports: [...cleanSet(19), clean(0)]}),
        want: 'fail',
        rules: ['duplicate_reports'],
    },
    {
        name: 'replays with different test sets',
        run: () => stability({reports: withReplaced(2, clean(2, [passingTest('PILOT-01 a')]))}),
        want: 'fail',
        rules: ['inconsistent_or_empty_tests'],
    },
    {
        name: 'passing replay with Network guard violations on stderr',
        run: () => {
            const report = clean(9);
            report.suites[0].specs[0].tests[0].results[0].stderr = [{text: 'Network guard violations: 1'}];
            return stability({reports: withReplaced(9, report)});
        },
        want: 'fail',
        rules: ['log_network_guard_violations'],
    },
    {
        name: 'passing replay with route handler error on stdout',
        run: () => {
            const report = clean(10);
            report.suites[0].specs[0].tests[0].results[0].stdout = [{text: 'route handler error: x'}];
            return stability({reports: withReplaced(10, report)});
        },
        want: 'fail',
        rules: ['log_route_handler_error'],
    },
];

function logChecks(tmp) {
    const logFile = (name, text) => {
        const file = path.join(tmp, name);
        fs.writeFileSync(file, text);
        return file;
    };
    return [
        {
            name: 'log mentioning disposed',
            result: stability({reports: cleanSet(), logs: [logFile('a.log', 'Fetch response has been disposed')]}),
            want: 'fail',
            rules: ['log_disposed'],
        },
        {
            name: 'log mentioning Test timeout',
            result: stability({reports: cleanSet(), logs: [logFile('b.log', 'Test timeout of 60000ms exceeded')]}),
            want: 'fail',
            rules: ['log_test_timeout'],
        },
        {
            name: 'clean log',
            result: stability({reports: cleanSet(), logs: [logFile('c.log', 'all good')]}),
            want: 'pass',
            rules: [],
        },
    ];
}

function traceChecks() {
    const base = readJsonFile(path.join(GATES_DIR, '../schemas/examples/trace.valid.json'));
    const changed = structuredClone(base);
    changed.states[0].snapshot_hash = 'ab'.repeat(32);
    return [
        {
            name: 'identical traces from two fresh stacks',
            result: stability({reports: cleanSet(), traces: [base, structuredClone(base)]}),
            want: 'pass',
            rules: [],
        },
        {
            name: 'normalised snapshot differs between stacks',
            result: stability({reports: cleanSet(), traces: [base, changed]}),
            want: 'fail',
            rules: ['trace_nondeterminism'],
        },
        {
            name: 'a single trace is not evidence of stability',
            result: stability({reports: cleanSet(), traces: [base]}),
            want: 'blocked',
            rules: ['trace_inputs'],
        },
    ];
}

// Independent oracle: regularised incomplete beta by continued fraction, quantile by bisection.
function lgamma(x) {
    const c = [
        76.18009172947147, -86.5053203294168, 24.01409824083091, -1.231739572450155, 1.20865097386618e-3,
        -5.395239384953e-6,
    ];
    let y = x;
    let tmp = x + 5.5;
    tmp -= (x + 0.5) * Math.log(tmp);
    let ser = 1.000000000190015;
    for (const coefficient of c) {
        ser += coefficient / ++y;
    }
    return -tmp + Math.log((2.506628274631 * ser) / x);
}

function betacf(a, b, x) {
    const tiny = 1e-300;
    let c = 1;
    let d = 1 - ((a + b) * x) / (a + 1);
    d = Math.abs(d) < tiny ? tiny : d;
    d = 1 / d;
    let h = d;
    for (let m = 1; m <= 500; m++) {
        const m2 = 2 * m;
        let aa = (m * (b - m) * x) / ((a + m2 - 1) * (a + m2));
        d = 1 + aa * d;
        d = Math.abs(d) < tiny ? tiny : d;
        c = 1 + aa / c;
        c = Math.abs(c) < tiny ? tiny : c;
        d = 1 / d;
        h *= d * c;
        aa = (-(a + m) * (a + b + m) * x) / ((a + m2) * (a + m2 + 1));
        d = 1 + aa * d;
        d = Math.abs(d) < tiny ? tiny : d;
        c = 1 + aa / c;
        c = Math.abs(c) < tiny ? tiny : c;
        d = 1 / d;
        const delta = d * c;
        h *= delta;
        if (Math.abs(delta - 1) < 1e-15) {
            break;
        }
    }
    return h;
}

function ibeta(x, a, b) {
    if (x <= 0) {
        return 0;
    }
    if (x >= 1) {
        return 1;
    }
    const front = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x));
    return x < (a + 1) / (a + b + 2) ? (front * betacf(a, b, x)) / a : 1 - (front * betacf(b, a, 1 - x)) / b;
}

function betaQuantile(q, a, b) {
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 200; i++) {
        const mid = (lo + hi) / 2;
        if (ibeta(mid, a, b) < q) {
            lo = mid;
        } else {
            hi = mid;
        }
    }
    return (lo + hi) / 2;
}

const near = (a, b, tol) => Math.abs(a - b) <= tol;

function clopperPearsonChecks() {
    const checks = [];
    const add = (name, ok, detail = '') => checks.push({name: `stability_gate: ${name}`, ok, detail});
    // Published 4-decimal values: [k, n, one-sided 95% upper, two-sided 95% lower, two-sided 95% upper].
    const known = [
        [0, 20, 0.1391, 0, 0.1684],
        [1, 20, 0.2161, 0.0013, 0.2487],
        [2, 20, 0.2826, 0.0123, 0.317],
        [10, 20, 0.698, 0.272, 0.728],
        [5, 10, 0.7776, 0.1871, 0.8129],
        [0, 10, 0.2589, 0, 0.3085],
    ];
    for (const [k, n, one, lowTwo, upTwo] of known) {
        const e1 = estimateFlake(k, n);
        const e2 = estimateFlake(k, n, {twoSided: true});
        add(
            `Clopper-Pearson ${k}/${n} one-sided 95% upper = ${one}`,
            near(e1.upper_bound, one, 6e-5),
            `got ${e1.upper_bound}`,
        );
        add(
            `Clopper-Pearson ${k}/${n} two-sided 95% interval = [${lowTwo}, ${upTwo}]`,
            near(e2.lower_bound, lowTwo, 6e-5) && near(e2.upper_bound, upTwo, 6e-5),
            `got [${e2.lower_bound}, ${e2.upper_bound}]`,
        );
    }
    add(
        'k = 0 matches the closed form 1 - alpha^(1/n) for n = 20',
        near(clopperPearsonUpper(0, 20, 0.05), 1 - 0.05 ** (1 / 20), 1e-12),
    );
    add(
        'k = 0 matches the closed form 1 - alpha^(1/n) for n = 59',
        near(clopperPearsonUpper(0, 59, 0.05), 1 - 0.05 ** (1 / 59), 1e-12),
    );
    add('k = n gives upper bound 1', clopperPearsonUpper(20, 20, 0.05) === 1 && clopperPearsonLower(0, 20, 0.05) === 0);
    add(
        'k = n lower bound matches the closed form alpha^(1/n)',
        near(clopperPearsonLower(20, 20, 0.05), 0.05 ** (1 / 20), 1e-12),
    );
    let worst = 0;
    let oracleWorst = 0;
    for (const n of [1, 2, 5, 10, 20, 50, 100]) {
        for (let k = 0; k < n; k++) {
            const upper = clopperPearsonUpper(k, n, 0.05);
            worst = Math.max(worst, Math.abs(binomialCdf(k, n, upper) - 0.05));
            oracleWorst = Math.max(oracleWorst, Math.abs(upper - betaQuantile(0.95, k + 1, n - k)));
            if (k > 0) {
                const lower = clopperPearsonLower(k, n, 0.025);
                oracleWorst = Math.max(oracleWorst, Math.abs(lower - betaQuantile(0.025, k, n - k + 1)));
            }
        }
    }
    add(
        'CDF at the upper bound equals alpha for every k < n <= 100 (error < 1e-9)',
        worst < 1e-9,
        `max error ${worst}`,
    );
    add(
        'bounds equal an independent incomplete-beta quantile (error < 1e-8)',
        oracleWorst < 1e-8,
        `max error ${oracleWorst}`,
    );
    add('0 failures need 59 runs to bound the flake rate below 5% at 95%', runsForZeroFailures(0.05) === 59);
    add('0 failures need 29 runs to bound below 10% at 95%', runsForZeroFailures(0.1) === 29);
    add('upper bound grows with failures', estimateFlake(0, 20).upper_bound < estimateFlake(1, 20).upper_bound);
    let rejected = false;
    try {
        estimateFlake(21, 20);
    } catch {
        rejected = true;
    }
    add('k > n is rejected', rejected);
    return checks;
}

export function selftestChecks() {
    const checks = [];
    const verdict = (name, result, want, rules) => {
        const got = result.evidence.map((e) => e.rule);
        const missing = rules.filter((r) => !got.includes(r));
        const ok = result.status === want && missing.length === 0;
        checks.push({
            name: `stability_gate: ${name}`,
            ok,
            detail: ok
                ? ''
                : `status ${result.status} (want ${want}); missing ${missing.join(',') || 'none'}; got ${got.join(',')}`,
        });
    };
    for (const c of STABILITY_CASES) {
        verdict(c.name, c.run(), c.want, c.rules);
    }
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'stability-'));
    try {
        for (const c of logChecks(tmp)) {
            verdict(c.name, c.result, c.want, c.rules);
        }
    } finally {
        fs.rmSync(tmp, {recursive: true, force: true});
    }
    for (const c of traceChecks()) {
        verdict(c.name, c.result, c.want, c.rules);
    }
    const counts = stability({reports: cleanSet()}).counts;
    checks.push({
        name: 'stability_gate: output carries counts only (no messages)',
        ok: JSON.stringify(counts).length < 500 && counts.passed === 40,
        detail: '',
    });
    return [...checks, ...clopperPearsonChecks()];
}
