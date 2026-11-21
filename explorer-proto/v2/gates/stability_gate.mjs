#!/usr/bin/env node
// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Gate `stability_20`: N fresh-fixture replay reports must all be clean passes (retries 0).
// Also: `--estimate-flake K N` prints an exact Clopper-Pearson bound, `--runs-for P` the zero-failure run count.
//
// Interface: gate.run({reports: [path|object], expected?: 20, logs?: [path], traces?: [path]}) -> {status, evidence, counts}.
// Evidence holds rule ids and counts only; never messages.
// CLI: stability_gate.mjs [--expected N] [--logs f]... [--trace f]... <report.json>...
//      stability_gate.mjs --estimate-flake K N [--confidence 0.95] [--two-sided]
//      stability_gate.mjs --runs-for P [--confidence 0.95]
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

import {
    UsageError,
    compareStrings,
    exitCodeFor,
    guarded,
    looksLikePlaywrightReport,
    parseArgs,
    positiveInt,
    printJson,
    readJsonFile,
    resultErrors,
    runCli,
    sha256,
    walkReport,
    worstStatus,
} from './common.mjs';
import {judge} from './replay_judge.mjs';

export const DEFAULT_REPLAYS = 20;

const FORBIDDEN_LOG_PATTERNS = {
    disposed: /disposed/i,
    network_guard_violations: /Network guard violations/i,
    route_handler_error: /route handler error/i,
    test_timeout: /Test timeout/i,
};

function* reportTexts(report) {
    for (const e of report.errors ?? []) {
        yield String(e?.message ?? '');
    }
    for (const {test} of walkReport(report)) {
        for (const result of test.results ?? []) {
            for (const e of resultErrors(result)) {
                yield String(e?.message ?? '');
            }
            for (const stream of [result.stdout, result.stderr]) {
                for (const chunk of stream ?? []) {
                    yield String(chunk?.text ?? chunk ?? '');
                }
            }
        }
    }
}

function countForbidden(texts) {
    const counts = Object.fromEntries(Object.keys(FORBIDDEN_LOG_PATTERNS).map((k) => [k, 0]));
    for (const text of texts) {
        for (const [name, re] of Object.entries(FORBIDDEN_LOG_PATTERNS)) {
            if (re.test(text)) {
                counts[name]++;
            }
        }
    }
    return counts;
}

function loadReport(input) {
    return typeof input === 'string' ? readJsonFile(input) : input;
}

function canonicalTrace(trace) {
    const states = [...(trace.states ?? [])].sort((a, b) => compareStrings(a.id, b.id));
    return sha256(JSON.stringify({states, transitions: trace.transitions ?? []}));
}

function traceDeterminism(traces, evidence) {
    const loaded = traces.map(loadReport);
    const hashes = new Set(loaded.map(canonicalTrace));
    if (loaded.length < 2) {
        evidence.push({rule: 'trace_inputs', count: loaded.length});
        return 'blocked';
    }
    if (hashes.size !== 1) {
        evidence.push({rule: 'trace_nondeterminism', count: hashes.size});
        return 'fail';
    }
    return 'pass';
}

export function stability({reports: inputs, expected = DEFAULT_REPLAYS, logs = [], traces = []}) {
    const evidence = [];
    const counts = {
        replays_expected: expected,
        replays_given: Array.isArray(inputs) ? inputs.length : 0,
        tests: 0,
        passed: 0,
        failed: 0,
        flaky: 0,
        skipped: 0,
        timed_out: 0,
        interrupted: 0,
        retried: 0,
        duplicate_reports: 0,
        forbidden_log_hits: {},
    };
    if (!Array.isArray(inputs) || inputs.length !== expected) {
        evidence.push({rule: 'replay_count', count: counts.replays_given, expected});
        return {status: 'blocked', evidence, counts};
    }

    const loaded = [];
    for (const input of inputs) {
        let report;
        try {
            report = loadReport(input);
        } catch (error) {
            if (error instanceof UsageError) {
                evidence.push({rule: 'report_unreadable'});
                return {status: 'blocked', evidence, counts};
            }
            throw error;
        }
        if (!looksLikePlaywrightReport(report)) {
            evidence.push({rule: 'report_unreadable'});
            return {status: 'blocked', evidence, counts};
        }
        loaded.push(report);
    }

    const failures = new Map();
    const note = (rule) => failures.set(rule, (failures.get(rule) ?? 0) + 1);
    const identities = new Set();
    const startTimes = new Set();
    const titleSets = new Set();
    const allTexts = [];

    for (const report of loaded) {
        const verdict = judge({reports: [report], expectation: {mode: 'pass'}});
        for (const e of verdict.evidence) {
            note(e.rule);
        }
        const tests = walkReport(report);
        counts.tests += tests.length;
        titleSets.add(JSON.stringify(tests.map((t) => t.title).sort()));
        for (const {test} of tests) {
            const statuses = (test.results ?? []).map((r) => r.status);
            if (test.status === 'expected' && statuses.length === 1 && statuses[0] === 'passed') {
                counts.passed++;
            } else {
                counts.failed++;
            }
            counts.flaky += test.status === 'flaky' ? 1 : 0;
            counts.skipped += test.status === 'skipped' ? 1 : 0;
            counts.timed_out += statuses.includes('timedOut') ? 1 : 0;
            counts.interrupted += statuses.includes('interrupted') ? 1 : 0;
            counts.retried += statuses.length > 1 ? 1 : 0;
        }
        const identity = sha256(JSON.stringify(report));
        if (identities.has(identity)) {
            counts.duplicate_reports++;
        }
        identities.add(identity);
        const start = report.stats?.startTime;
        if (start !== undefined) {
            if (startTimes.has(start)) {
                counts.duplicate_reports++;
            }
            startTimes.add(start);
        }
        allTexts.push(...reportTexts(report));
    }

    for (const file of logs) {
        try {
            allTexts.push(fs.readFileSync(file, 'utf8'));
        } catch {
            throw new UsageError('cannot read a log file');
        }
    }
    counts.forbidden_log_hits = countForbidden(allTexts);

    if (counts.duplicate_reports > 0) {
        note('duplicate_reports');
    }
    if (titleSets.size !== 1 || counts.tests === 0) {
        note('inconsistent_or_empty_tests');
    }
    for (const [name, n] of Object.entries(counts.forbidden_log_hits)) {
        if (n > 0) {
            note(`log_${name}`);
        }
    }

    let status = failures.size === 0 && counts.passed === counts.tests ? 'pass' : 'fail';
    for (const [rule, n] of [...failures.entries()].sort()) {
        evidence.push({rule, count: n});
    }
    if (traces.length > 0) {
        const traceStatus = traceDeterminism(traces, evidence);
        status = worstStatus(status, traceStatus);
    }
    return {status, evidence, counts};
}

// ---- Clopper-Pearson (exact binomial) ----

function lnFactorials(n) {
    const table = [0];
    for (let i = 1; i <= n; i++) {
        table[i] = table[i - 1] + Math.log(i);
    }
    return table;
}

// P(X <= k) for X ~ Binomial(n, p), summed term by term in log space.
export function binomialCdf(k, n, p) {
    if (k >= n) {
        return 1;
    }
    if (p <= 0) {
        return 1;
    }
    if (p >= 1) {
        return 0;
    }
    const lf = lnFactorials(n);
    let sum = 0;
    for (let i = 0; i <= k; i++) {
        sum += Math.exp(lf[n] - lf[i] - lf[n - i] + i * Math.log(p) + (n - i) * Math.log(1 - p));
    }
    return Math.min(1, sum);
}

function bisect(f, increasing) {
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 200; i++) {
        const mid = (lo + hi) / 2;
        const tooLow = increasing ? f(mid) < 0 : f(mid) > 0;
        if (tooLow) {
            lo = mid;
        } else {
            hi = mid;
        }
    }
    return (lo + hi) / 2;
}

// Upper bound p_U with P(X <= k | p_U) = alpha (exact; alpha is the one-sided tail probability).
export function clopperPearsonUpper(k, n, alpha) {
    if (k >= n) {
        return 1;
    }
    return bisect((p) => binomialCdf(k, n, p) - alpha, false);
}

// Lower bound p_L with P(X >= k | p_L) = alpha.
export function clopperPearsonLower(k, n, alpha) {
    if (k <= 0) {
        return 0;
    }
    return bisect((p) => 1 - binomialCdf(k - 1, n, p) - alpha, true);
}

function validateRate(k, n, confidence) {
    if (!Number.isInteger(k) || !Number.isInteger(n) || k < 0 || n < 1 || k > n) {
        throw new UsageError('need integers 0 <= K <= N and N >= 1');
    }
    if (!(confidence > 0 && confidence < 1)) {
        throw new UsageError('--confidence must be between 0 and 1');
    }
}

const round6 = (x) => Math.round(x * 1e6) / 1e6;

export function estimateFlake(k, n, {confidence = 0.95, twoSided = false} = {}) {
    validateRate(k, n, confidence);
    const alpha = twoSided ? (1 - confidence) / 2 : 1 - confidence;
    const upper = clopperPearsonUpper(k, n, alpha);
    const lower = clopperPearsonLower(k, n, alpha);
    return {
        failures: k,
        runs: n,
        confidence,
        interval: twoSided ? 'two-sided' : 'one-sided upper',
        observed_rate: round6(k / n),
        upper_bound: round6(upper),
        ...(twoSided ? {lower_bound: round6(lower)} : {}),
        reading: `with ${k} failure(s) in ${n} runs the true flake rate cannot be ruled out up to ${round6(upper * 100)}% at ${confidence * 100}% confidence`,
    };
}

// Smallest N such that 0 failures in N runs bounds the flake rate below P (one-sided).
export function runsForZeroFailures(rate, confidence = 0.95) {
    if (!(rate > 0 && rate < 1)) {
        throw new UsageError('--runs-for needs a rate between 0 and 1');
    }
    return Math.ceil(Math.log(1 - confidence) / Math.log(1 - rate));
}

export const gate = {
    id: 'stability_20',
    run(ctx = {}) {
        return guarded(() => {
            const {status, evidence, counts} = stability({
                reports: ctx.reports,
                expected: ctx.expected ?? DEFAULT_REPLAYS,
                logs: ctx.logs ?? [],
                traces: ctx.traces ?? [],
            });
            return {status, evidence, counts};
        });
    },
};

async function main() {
    const {positional, values} = parseArgs(process.argv.slice(2), {
        flags: ['estimate-flake', 'two-sided'],
        options: ['expected', 'confidence', 'runs-for'],
        multi: ['logs', 'trace'],
    });
    const confidence = values.confidence === undefined ? 0.95 : Number(values.confidence);
    if (values['runs-for'] !== undefined) {
        const rate = Number(values['runs-for']);
        printJson({rate, confidence, zero_failure_runs_needed: runsForZeroFailures(rate, confidence)});
        return 0;
    }
    if (values['estimate-flake']) {
        if (positional.length !== 2) {
            throw new UsageError('usage: stability_gate.mjs --estimate-flake K N [--confidence 0.95] [--two-sided]');
        }
        printJson(
            estimateFlake(Number(positional[0]), Number(positional[1]), {
                confidence,
                twoSided: Boolean(values['two-sided']),
            }),
        );
        return 0;
    }
    if (positional.length === 0) {
        throw new UsageError('usage: stability_gate.mjs [--expected N] [--logs f]... [--trace f]... <report.json>...');
    }
    const expected = values.expected === undefined ? DEFAULT_REPLAYS : positiveInt(values.expected, '--expected');
    const result = stability({reports: positional, expected, logs: values.logs ?? [], traces: values.trace ?? []});
    printJson(result);
    return exitCodeFor(result.status);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    runCli(main);
}
