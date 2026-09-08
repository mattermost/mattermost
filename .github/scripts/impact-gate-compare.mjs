#!/usr/bin/env node
// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// Read-only comparison. Runs from trusted workflow code; tested source is Git data only.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {appendFileSync, lstatSync, mkdirSync, readFileSync, realpathSync, writeFileSync} from 'node:fs';
import {dirname, relative, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

export const hash = (value) => createHash('sha256').update(value).digest('hex');
const requireThat = (value, message) => assert.ok(value, message);
const sorted = (values) => [...values].sort();
const equal = (left, right, message) => assert.deepEqual(left, right, message);
const sameSet = (left, right, message) => equal(sorted(left), sorted(right), message);
const sha = (value) => typeof value === 'string' && /^[a-f0-9]{40}$/.test(value);
const id = (value) => (typeof value === 'string' || Number.isSafeInteger(value)) && /^[1-9][0-9]*$/.test(String(value));
const terminal = {completed_pass: new Set(['passed', 'flaky']), completed_fail: new Set(['failed']), completed_skipped: new Set(['skipped'])};
const failures = new Set(['failed', 'timedOut', 'timed_out', 'interrupted']);
const states = ['pending', 'leased', 'abandoned', 'retest_eligible', ...Object.keys(terminal)];

// Reviewed worker topology in e2e-tests-{cypress,playwright}.yml. Changing the
// trusted topology requires updating this contract; TSIO counts cannot define it.
export function workerContract(suite) {
    requireThat(/^(cypress|playwright)-full-(enterprise|fips)$/.test(suite.id), 'Unsupported full-suite identity');
    requireThat(suite.id === `${suite.framework}-full-${suite.variant}`, 'Suite framework/edition identity mismatch');
    return {count: suite.framework === 'cypress' ? 40 : 20,
        prefix: `e2e-${suite.framework}${suite.variant === 'fips' ? '-fips' : ''} / ${suite.framework}-full / dispatch-run-`};
}

function repositoryPath(value) {
    requireThat(typeof value === 'string' && value && !/^[A-Za-z]:|^\//.test(value) && !/[\\\0]/.test(value) && !value.split('/').some((part) => ['', '.', '..'].includes(part)), 'Invalid repository-relative path');
    return value;
}

// Small, explicit glob dialect for the pinned Mattermost manifest. Reject any
// unsupported syntax rather than accepting a silently incomplete inventory.
export function globMatcher(pattern) {
    requireThat(typeof pattern === 'string' && pattern.length > 0 && pattern.length <= 1024 && !/^[!#\/]|[\\\[\]()]|(^|\/)\.\.(\/|$)/.test(pattern), 'Unsupported inventory pattern');
    let patterns = [pattern];
    while (patterns.some((p) => p.includes('{'))) {
        patterns = patterns.flatMap((p) => {
            const match = p.match(/\{([^{}]+)\}/);
            requireThat(match || !p.includes('{'), 'Unsupported brace pattern');
            return match ? match[1].split(',').map((part) => p.slice(0, match.index) + part + p.slice(match.index + match[0].length)) : [p];
        });
        requireThat(patterns.length <= 64, 'Inventory pattern expansion limit exceeded');
    }
    const expressions = patterns.map((p) => {
        requireThat(!/[{}]/.test(p), 'Unsupported brace pattern');
        let result = '^';
        for (let i = 0; i < p.length; i++) {
            if (p.slice(i, i + 3) === '**/') {result += '(?:.*/)?'; i += 2;}
            else if (p.slice(i, i + 2) === '**') {result += '.*'; i++;}
            else if (p[i] === '*') result += '[^/]*';
            else if (p[i] === '?') result += '[^/]';
            else result += p[i].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        }
        return new RegExp(result + '$', 'u');
    });
    return (file) => expressions.some((pattern) => pattern.test(file));
}

export function gitContext(checkout, identity, verifyWorkflow = true) {
    const root = realpathSync(checkout);
    const git = (...args) => execFileSync('git', ['--no-replace-objects', '-c', 'core.fsmonitor=false', ...args], {
        cwd: root, encoding: 'utf8', timeout: 30000, maxBuffer: 64 * 1024 * 1024,
        env: {...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1', GIT_OPTIONAL_LOCKS: '0'},
    });
    for (const field of ['tested_sha', 'base_sha', 'workflow_sha', 'planner_sha']) requireThat(sha(identity[field]), `Invalid ${field}`);
    requireThat(identity.repository === 'mattermost/mattermost', 'Unsupported repository');
    requireThat(id(identity.run_id) && id(identity.run_attempt), 'Invalid GitHub run identity');
    requireThat(/^(https:\/\/github\.com\/|git@github\.com:)mattermost\/mattermost(?:\.git)?$/.test(git('remote', 'get-url', 'origin').trim()), 'Checkout origin mismatch');
    if (verifyWorkflow) requireThat(git('rev-parse', 'HEAD').trim() === identity.workflow_sha, 'Trusted workflow checkout SHA mismatch');
    for (const name of ['tested_sha', 'base_sha']) requireThat(git('rev-parse', '--verify', `${identity[name]}^{commit}`).trim() === identity[name], `Missing immutable ${name}`);
    const mergeBases = git('merge-base', '--all', identity.base_sha, identity.tested_sha).trim().split('\n');
    requireThat(mergeBases.length === 1 && sha(mergeBases[0]), 'Ambiguous Git merge base');
    const mergeBase = mergeBases[0];
    const changes = git('diff', '--name-only', '--no-renames', '--ignore-submodules=none', '-z', mergeBase, identity.tested_sha, '--').split('\0').filter(Boolean).sort();
    const entries = new Map(git('ls-tree', '-r', '-z', identity.tested_sha).split('\0').filter(Boolean).map((row) => {
        const tab = row.indexOf('\t');
        const [mode, type, blob] = row.slice(0, tab).split(' ');
        return [row.slice(tab + 1), {mode, type, blob}];
    }));
    const regularFile = (name) => {
        repositoryPath(name);
        const entry = entries.get(name);
        requireThat(entry?.type === 'blob' && ['100644', '100755'].includes(entry.mode), `Not a regular committed file: ${name}`);
        return entry;
    };
    const bytes = (name) => Buffer.from(git('cat-file', 'blob', regularFile(name).blob));
    return {mergeBase, changes, entries, regularFile, bytes};
}

export function validatePlan(plan, config, identity, context) {
    const a = plan.advisory;
    requireThat(plan.schemaVersion === '1.0.0' && a?.mode === 'advisory', 'Not an advisory PlanReport');
    requireThat(plan.sourceRunId === `github:${identity.repository}:${identity.run_id}:${identity.run_attempt}`, 'Plan sourceRunId mismatch');
    requireThat(a.repository === identity.repository && a.headSha === identity.tested_sha && a.requestedBaseSha === identity.base_sha && a.baseSha === context.mergeBase, 'Plan Git provenance mismatch');
    requireThat(config?.repository === identity.repository && Array.isArray(config.suites) && Array.isArray(config.mappings) && config.mappings.length === 0, 'Unsupported or unreviewed mapping configuration');
    const suite = config.suites.find((candidate) => candidate.id === a.suite?.id);
    requireThat(suite, 'Unknown plan suite');
    workerContract(suite);
    const {configSha256, ...actualSuite} = a.suite;
    equal(actualSuite, suite, 'Plan suite/project/browser/edition mismatch');
    repositoryPath(suite.root);
    equal(configSha256, hash(context.bytes(suite.configFile)), 'Committed suite configuration hash mismatch');
    equal(a.configurationSha256, hash(JSON.stringify(config)), 'Pinned planner configuration hash mismatch');
    equal(a.changedFiles, context.changes, 'Complete changed-file set mismatch');
    equal(a.changedFilesSha256, hash(JSON.stringify(context.changes)), 'Changed-file digest mismatch');
    equal(a.diffStatus, context.changes.length ? 'changed' : 'empty', 'Diff status mismatch');
    requireThat(a.inventoryStatus === 'static-spec-files' && a.executionPolicy === 'retain-full-suite', 'Selection is not static advisory evidence');
    requireThat(plan.enforcement?.mode === 'advisory' && plan.enforcement.shouldFail === false && plan.decision?.action === 'run-now', 'Unexpected enforcement or release assertion');
    requireThat(plan.confidence === null && plan.confidenceKind === 'unavailable' && a.evidence?.coverage === 'unavailable' && a.evidence.execution === 'unavailable' && a.evidence.release === 'not-assessed' && a.evidence.measuredCoverageEdges === 0, 'Unexpected behavioral evidence assertion');
    const include = globMatcher(suite.specPattern);
    const exclude = (suite.exclude ?? []).map(globMatcher);
    const expectedInventory = [...context.entries.keys()].filter((path) => path.startsWith(suite.root + '/') && include(path.slice(suite.root.length + 1)) && !exclude.some((pattern) => pattern(path.slice(suite.root.length + 1)))).sort();
    equal(a.inventory, expectedInventory, 'Committed static inventory mismatch');
    a.inventory.forEach(context.regularFile);
    requireThat(Array.isArray(a.selectedSpecs) && new Set(a.selectedSpecs).size === a.selectedSpecs.length, 'Invalid/duplicate selection');
    const inventory = new Set(a.inventory);
    a.selectedSpecs.forEach((path) => {repositoryPath(path); requireThat(inventory.has(path), 'Selected path outside inventory');});
    equal(plan.recommendedTests, a.selectedSpecs, 'Plan selections disagree');
    requireThat(Array.isArray(a.fileAssessments) && a.fileAssessments.every((file) => ['unmapped', 'unsupported', 'cross-cutting'].includes(file.status) && typeof file.reason === 'string' && file.reason), 'Unverified mapping or invalid file assessment');
    sameSet(a.fileAssessments.map((file) => file.file), context.changes, 'Missing/duplicate file assessments');
    requireThat(Array.isArray(a.mappings) && a.mappings.length === 0, 'Unexpected mapping candidates');
    requireThat(Array.isArray(a.fullSuiteFallbackReasons), 'Missing fallback reasons');
    const full = a.fullSuiteFallbackReasons.length > 0;
    if (context.changes.length || !inventory.size) requireThat(full, 'Unmapped changes or missing inventory require full fallback');
    if (full) {
        requireThat(plan.runSet === 'full', 'Full fallback mislabeled');
        sameSet(a.selectedSpecs, a.inventory, 'Full fallback omitted inventory');
    } else requireThat(a.selectedSpecs.length === 0 && context.changes.length === 0, 'Unexpected targeted recommendation');
    return {suite, advisory: a, inventory, selection: new Set(a.selectedSpecs)};
}

function assertIdentity(value, suite, identity, commitField = 'commit_sha') {
    requireThat(value?.repository === identity.repository && value[commitField] === identity.tested_sha && String(value.gh_run_id) === identity.run_id && String(value.gh_run_attempt) === identity.run_attempt && value.name === suite.id && value.framework === suite.framework, 'TSIO repository/commit/run/attempt/suite identity mismatch');
}

export function compareSuite({plan, evidence, detail, orchestration}, {config, identity, jobs, context}) {
    const {suite, advisory, inventory, selection} = validatePlan(plan, config, identity, context);
    assertIdentity(evidence?.group, suite, identity);
    assertIdentity(detail, suite, identity, 'commit');
    assertIdentity(orchestration, suite, identity);
    requireThat(detail.id === evidence.group.id, 'Evidence/report group mismatch');
    const environment = evidence.group.environment_metadata;
    requireThat(environment?.server_edition === suite.variant && environment.server === 'onprem', 'TSIO edition/server mismatch');
    if (suite.framework === 'playwright') requireThat(environment.playwright_project === suite.project, 'TSIO Playwright project mismatch');
    else requireThat(environment.test_type === 'full' && suite.project === suite.root, 'TSIO Cypress project/type mismatch');
    const reasons = [];
    const check = (condition, message) => {if (!condition) reasons.push(message);};
    const contract = workerContract(suite);
    requireThat(Array.isArray(jobs.jobs) && jobs.total_count === jobs.jobs.length && new Set(jobs.jobs.map((job) => String(job.id))).size === jobs.jobs.length, 'GitHub job pagination incomplete or duplicate');
    const expectedNames = Array.from({length: contract.count}, (_, i) => `${contract.prefix}${i + 1}`);
    const candidates = jobs.jobs.filter((job) => job.name.startsWith(contract.prefix));
    check(candidates.length === contract.count && new Set(candidates.map((job) => job.name)).size === contract.count && candidates.every((job) => expectedNames.includes(job.name)), 'GitHub expected worker census mismatch');
    for (const job of candidates) requireThat(id(job.id) && String(job.run_id) === identity.run_id && String(job.run_attempt) === identity.run_attempt && job.head_sha === identity.workflow_sha && job.run_url === `https://api.github.com/repos/${identity.repository}/actions/runs/${identity.run_id}`, 'GitHub worker run/attempt/workflow-SHA identity mismatch');
    check(candidates.every((job) => job.status === 'completed' && typeof job.conclusion === 'string' && job.conclusion), 'GitHub workers are not terminal');
    const workers = new Map(candidates.map((job) => [String(job.id), job]));
    requireThat(Array.isArray(detail.reports), 'Missing worker reports');
    const reportWorkers = new Set(detail.reports.map((report) => String(report.gh_job_id)));
    const missing = sorted([...workers.keys()].filter((worker) => !reportWorkers.has(worker)));
    const unexpected = sorted([...reportWorkers].filter((worker) => !workers.has(worker)));
    check(detail.reports.length === contract.count && new Set(detail.reports.map((report) => report.id)).size === contract.count && reportWorkers.size === contract.count, 'Worker report count or uniqueness mismatch');
    check(missing.length === 0 && unexpected.length === 0, 'Worker report membership mismatch');
    check(detail.reports.every((report) => report.status === 'complete' && workers.get(String(report.gh_job_id))?.name === report.gh_job_name), 'Worker report incomplete or name mismatch');
    check(evidence.complete === true && evidence.truncated === false && evidence.group.status === 'completed' && detail.status === 'completed', 'Report evidence incomplete or truncated');
    check(evidence.group.total_reports_expected === contract.count && evidence.group.reports_registered === contract.count && evidence.group.reports_complete === contract.count && detail.total_reports_expected === contract.count, 'Report completion counts disagree with expected workers');
    requireThat(Array.isArray(evidence.clusters) && evidence.clusters.every((cluster) => Array.isArray(cluster.members)), 'Malformed failure evidence');
    check(evidence.cluster_count === evidence.clusters.length && evidence.clusters.every((cluster) => cluster.member_count === cluster.members.length) && evidence.failure_count === evidence.clusters.reduce((sum, cluster) => sum + cluster.members.length, 0), 'Failure evidence membership incomplete');
    // Cluster representatives may be another test. They neither define the
    // failed-spec denominator nor prove file identity for every cluster member.
    requireThat(Array.isArray(orchestration.units) && new Set(orchestration.units.map((unit) => unit.spec_path)).size === orchestration.units.length, 'Missing/duplicate dispatch units');
    const units = orchestration.units;
    check(orchestration.status === 'completed' && orchestration.total_units === units.length, 'Orchestration is incomplete');
    for (const state of states) check(Number.isInteger(orchestration.counts?.[state]) && orchestration.counts[state] === units.filter((unit) => unit.state === state).length, `Orchestration count mismatch: ${state}`);
    check(units.every((unit) => terminal[unit.state] && unit.current_lease === null), 'Unresolved dispatch units');
    const finalFailures = [];
    const retrySurvivors = [];
    const attemptedPathsByTitle = new Map();
    const validTestIdentity = (test, spec) => typeof test?.full_title === 'string' && test.full_title.trim() && ['passed', 'flaky', 'skipped', ...failures].includes(test.status) && (test.project === undefined || test.project === suite.project) && (test.file === undefined || test.file === spec);
    for (const unit of units) {
        repositoryPath(unit.spec_path);
        const path = `${suite.root}/${unit.spec_path}`;
        context.regularFile(path);
        requireThat(inventory.has(path), 'Dispatched path outside static inventory');
        requireThat(Array.isArray(unit.attempts), 'Missing attempt evidence');
        for (const attempt of unit.attempts) {
            requireThat(attempt.spec_path === unit.spec_path && workers.get(String(attempt.gh_job_id))?.name === attempt.gh_job_name, 'Attempt worker or path identity mismatch');
            if (!Number.isFinite(Date.parse(attempt.reported_at)) || !Array.isArray(attempt.test_cases)) continue;
            for (const test of attempt.test_cases) {
                requireThat(validTestIdentity(test, unit.spec_path), 'Attempt test file/title/project/status mismatch');
                if (!attemptedPathsByTitle.has(test.full_title)) attemptedPathsByTitle.set(test.full_title, new Set());
                attemptedPathsByTitle.get(test.full_title).add(path);
            }
        }
        if (!terminal[unit.state] || unit.current_lease !== null) continue;
        const valid = unit.attempts.filter((attempt) => attempt.expired === false && attempt.late_report === false && Number.isFinite(Date.parse(attempt.reported_at))).sort((left, right) => Date.parse(left.reported_at) - Date.parse(right.reported_at));
        const last = valid.at(-1);
        if (!last || !terminal[unit.state].has(last.status) || last.reported_at !== unit.outcome_set_at || (valid.length > 1 && valid.at(-2).reported_at === last.reported_at)) {reasons.push(`Ambiguous/missing terminal attempt: ${path}`); continue;}
        if (!Array.isArray(last.test_cases) || (last.status !== 'skipped' && last.test_cases.length === 0)) {reasons.push(`Missing terminal test cases: ${path}`); continue;}
        requireThat(last.test_cases.every((test) => validTestIdentity(test, unit.spec_path)), 'Test file/title/project/status mismatch');
        const failed = last.test_cases.filter((test) => failures.has(test.status));
        if (unit.state === 'completed_fail' && !failed.length) {reasons.push(`Final failed spec lacks test-level failure evidence: ${path}`); continue;}
        if (unit.state !== 'completed_fail' && failed.length) {reasons.push(`Terminal unit/test outcomes disagree: ${path}`); continue;}
        if (failed.length) finalFailures.push({file: path, included: selection.has(path), tests: failed.map((test) => ({full_title: test.full_title, status: test.status})), attempt_id: last.id, causal_regression: 'unknown'});
        else if (unit.state === 'completed_pass' && (valid.some((attempt) => attempt.status === 'failed') || last.test_cases.some((test) => test.status === 'flaky'))) retrySurvivors.push({file: path, included: selection.has(path), counted_as_final_failure: false});
    }
    // Independent report failures cannot disappear from the dispatch evidence.
    // Members expose titles, not reliable file identities: demand one matching
    // spec across all reported attempts, including failures healed by a retry.
    // This checks consistency only; final orchestration outcomes still define
    // the denominator, never stable keys or a cluster's representative file.
    for (const member of evidence.clusters.flatMap((cluster) => cluster.members)) {
        const matches = attemptedPathsByTitle.get(member?.full_title);
        check(matches?.size === 1, `Report failure member ${matches?.size ? 'ambiguous across dispatched specs' : 'missing from reported attempts'}: ${member?.full_title || '(missing title)'}`);
    }
    finalFailures.sort((left, right) => left.file.localeCompare(right.file));
    retrySurvivors.sort((left, right) => left.file.localeCompare(right.file));
    const complete = reasons.length === 0;
    const included = finalFailures.filter((failure) => failure.included).length;
    const dispatched = units.filter((unit) => unit.attempts.length > 0);
    return {
        suite: suite.id, status: complete ? 'complete' : 'unavailable', unavailable_reasons: [...new Set(reasons)],
        project: suite.project, browser: suite.browser, variant: suite.variant,
        selection: {selected_static: selection.size, total_static: inventory.size, registered_units: units.length, selected_dispatched: dispatched.filter((unit) => selection.has(`${suite.root}/${unit.spec_path}`)).length, total_dispatched: dispatched.length, terminal_dispatched: dispatched.filter((unit) => terminal[unit.state] && unit.current_lease === null).length, dispatched_skipped: dispatched.filter((unit) => unit.state === 'completed_skipped').length},
        workers: {expected: contract.count, github_census: candidates.length, received_reports: detail.reports.length, complete_reports: detail.reports.filter((report) => report.status === 'complete').length, missing_worker_ids: missing, unexpected_worker_ids: unexpected},
        final_failures_observed: finalFailures, retry_survivors_excluded: retrySurvivors,
        observed_counts: {final_failed_specs: finalFailures.length, included_failed_specs: included, missed_failed_specs: finalFailures.length - included},
        observed_failure_selection_recall: {available: complete && finalFailures.length > 0, included: complete ? included : null, missed: complete ? finalFailures.length - included : null, total: complete ? finalFailures.length : null, rate: complete && finalFailures.length ? included / finalFailures.length : null, reason: !complete ? 'Unavailable: execution evidence is incomplete or inconsistent' : finalFailures.length ? 'Observed terminal failed-spec selection for this run only' : 'Undefined: no observed terminal failed specs'},
        full_suite_fallback_reasons: advisory.fullSuiteFallbackReasons,
        evidence_scope: 'Spec paths and terminal test titles from orchestration; project/edition from report-group metadata. Cluster representatives and stable keys do not determine this denominator.',
        behavioral_coverage: 'unavailable', causal_regression_accuracy: null, confirmed_missed_regressions: null, measured_time_savings: null, release: 'not-assessed', execution_policy: 'retain-full-suite',
    };
}

function unavailable(suite, error) {
    return {suite, status: 'unavailable', unavailable_reasons: [error.message], selection: null, observed_counts: null,
        observed_failure_selection_recall: {available: false, included: null, missed: null, total: null, rate: null, reason: 'Unavailable: inputs could not be validated'},
        behavioral_coverage: 'unavailable', causal_regression_accuracy: null, measured_time_savings: null, release: 'not-assessed', execution_policy: 'retain-full-suite'};
}

export async function fetchJson(url, {token, github = false, fetchImpl = fetch, receipt} = {}) {
    const target = new URL(url);
    requireThat(target.protocol === 'https:' && !target.username && !target.password && !target.hash && (!github || target.origin === 'https://api.github.com'), 'Unsafe API URL');
    const headers = {Accept: 'application/json'};
    if (github && token) headers.Authorization = `Bearer ${token}`;
    const response = await fetchImpl(target.href, {method: 'GET', headers, redirect: 'error', signal: AbortSignal.timeout(20000)});
    requireThat(response.ok, `API read failed (${response.status}): ${target.pathname}`);
    const chunks = [];
    let size = 0;
    for await (const chunk of response.body) {
        size += chunk.byteLength;
        requireThat(size <= 32 * 1024 * 1024, 'API response exceeds 32 MiB');
        chunks.push(chunk);
    }
    const bytes = Buffer.concat(chunks);
    const value = JSON.parse(bytes.toString('utf8'));
    if (receipt) receipt(target.href, bytes);
    return value;
}

export async function fetchJobs(identity, read) {
    const jobs = [];
    let expected;
    for (let page = 1; page <= 20; page++) {
        const response = await read(`https://api.github.com/repos/${identity.repository}/actions/runs/${identity.run_id}/attempts/${identity.run_attempt}/jobs?per_page=100&page=${page}`, true);
        requireThat(Number.isInteger(response.total_count) && response.total_count >= 0 && response.total_count <= 2000 && Array.isArray(response.jobs), 'Invalid GitHub jobs response');
        expected ??= response.total_count;
        requireThat(response.total_count === expected && response.jobs.length <= 100, 'GitHub pagination changed while reading');
        jobs.push(...response.jobs);
        requireThat(jobs.length <= expected, 'GitHub jobs pagination overflow');
        if (jobs.length === expected) {
            requireThat(new Set(jobs.map((job) => String(job.id))).size === jobs.length, 'Duplicate paginated GitHub jobs');
            return {total_count: expected, jobs};
        }
        requireThat(response.jobs.length === 100, 'Incomplete GitHub jobs pagination');
    }
    throw new Error('GitHub jobs pagination limit exceeded');
}

function readRegular(path, maxBytes = 32 * 1024 * 1024) {
    const stat = lstatSync(path);
    requireThat(stat.isFile() && !stat.isSymbolicLink() && stat.size <= maxBytes, 'Input must be a bounded regular file');
    return readFileSync(path);
}

export function loadPlans(directory, identity) {
    const manifest = JSON.parse(readRegular(resolve(directory, 'provenance.json')));
    for (const [key, value] of Object.entries(identity)) equal(manifest[key], value, `Artifact provenance mismatch: ${key}`);
    requireThat(Array.isArray(manifest.plans) && manifest.plans.length > 0 && manifest.plans.length <= 4 && new Set(manifest.plans.map((plan) => plan.suite)).size === manifest.plans.length, 'Invalid plan artifact membership');
    const suiteIds = manifest.plans.map((plan) => plan.suite);
    requireThat(suiteIds.includes('cypress-full-enterprise') && suiteIds.includes('playwright-full-enterprise') && suiteIds.includes('cypress-full-fips') === suiteIds.includes('playwright-full-fips'), 'Missing enterprise or paired FIPS plans');
    return manifest.plans.map((entry) => {
        requireThat(/^(cypress|playwright)-full-(enterprise|fips)$/.test(entry.suite) && entry.file === `${entry.suite}.json`, 'Invalid artifact path/suite');
        const bytes = readRegular(resolve(directory, entry.file));
        equal(hash(bytes), entry.sha256, 'Plan artifact digest mismatch');
        const plan = JSON.parse(bytes);
        equal(plan.advisory?.suite?.id, entry.suite, 'Artifact suite mismatch');
        return {suite: entry.suite, plan, sha256: hash(bytes)};
    });
}

export function summaryMarkdown(result) {
    const lines = ['## Impact Gate advisory comparison', '', 'Existing full-suite execution is retained. This report does not assess changed-behavior coverage, causality, release safety, or time savings.', '', '| Suite | Static selected | Dispatched selected | Skipped | Complete reports | Observed failed specs | Failure-selection recall |', '| --- | ---: | ---: | ---: | ---: | ---: | --- |'];
    for (const suite of result.suites) {
        const s = suite.selection;
        const recall = suite.observed_failure_selection_recall;
        lines.push(`| ${suite.suite} | ${s ? `${s.selected_static}/${s.total_static}` : 'unavailable'} | ${s ? `${s.selected_dispatched}/${s.total_dispatched}` : 'unavailable'} | ${s?.dispatched_skipped ?? 'unavailable'} | ${suite.workers ? `${suite.workers.complete_reports}/${suite.workers.expected}` : 'unavailable'} | ${suite.observed_counts?.final_failed_specs ?? 'unavailable'} | ${recall.available ? `${recall.included}/${recall.total}` : 'unavailable'} |`);
    }
    for (const suite of result.suites) if (suite.unavailable_reasons.length) lines.push('', `${suite.suite}: ${suite.unavailable_reasons.map((text) => String(text).replace(/[\r\n|<>]/g, ' ').slice(0, 400)).join('; ')}`);
    return lines.join('\n') + '\n';
}

export async function main(env = process.env) {
    const identity = {repository: env.GITHUB_REPOSITORY, tested_sha: env.TESTED_SHA, base_sha: env.BASE_SHA, workflow_sha: env.GITHUB_SHA, run_id: env.GITHUB_RUN_ID, run_attempt: env.GITHUB_RUN_ATTEMPT, planner_sha: env.IMPACT_GATE_PLANNER_SHA};
    requireThat(env.COMPARISON_OUTPUT && env.IMPACT_GATE_PLANS && env.IMPACT_GATE_CONFIG, 'Missing comparison input/output configuration');
    const output = resolve(env.COMPARISON_OUTPUT);
    mkdirSync(resolve(output, 'evidence'), {recursive: true});
    const receipts = [];
    const result = {schema_version: 1, kind: 'read-only-current-run-advisory-comparison', ...identity, suites: [], source_receipts: receipts, release: 'not-assessed', execution_policy: 'retain-full-suite'};
    try {
        const context = gitContext(process.cwd(), identity);
        const configBytes = readRegular(env.IMPACT_GATE_CONFIG);
        // Config comes from the separately checked-out pinned planner repository.
        const configFile = realpathSync(env.IMPACT_GATE_CONFIG);
        const configDir = dirname(configFile);
        const git = (...args) => execFileSync('git', ['--no-replace-objects', ...args], {cwd: configDir, encoding: 'utf8', timeout: 30000, maxBuffer: 1024 * 1024});
        equal(git('rev-parse', 'HEAD').trim(), identity.planner_sha, 'Pinned planner checkout SHA mismatch');
        const configRoot = realpathSync(git('rev-parse', '--show-toplevel').trim());
        const configPath = repositoryPath(relative(configRoot, configFile));
        equal(Buffer.from(git('show', `${identity.planner_sha}:${configPath}`)), configBytes, 'Pinned configuration bytes mismatch');
        const config = JSON.parse(configBytes).advisory;
        const plans = loadPlans(env.IMPACT_GATE_PLANS, identity);
        result.input_sha256 = {configuration: hash(configBytes), provenance: hash(readRegular(resolve(env.IMPACT_GATE_PLANS, 'provenance.json'))), plans: Object.fromEntries(plans.map((entry) => [entry.suite, entry.sha256]))};
        const tsio = new URL(env.TSIO_URL);
        requireThat(tsio.protocol === 'https:' && !tsio.username && !tsio.password && !tsio.search && !tsio.hash && /\/api\/v1\/?$/.test(tsio.pathname), 'Invalid public TSIO API URL');
        const read = (url, github = false) => fetchJson(url, {github, token: env.GH_TOKEN, receipt: (source, bytes) => {
            const file = `response-${String(receipts.length + 1).padStart(3, '0')}.json`;
            writeFileSync(resolve(output, 'evidence', file), bytes);
            receipts.push({file: `evidence/${file}`, url: source, method: 'GET', bytes: bytes.length, sha256: hash(bytes), retrieved_at: new Date().toISOString()});
        }});
        const jobs = await fetchJobs(identity, read);
        for (const suite of config.suites) {
            const {prefix} = workerContract(suite);
            requireThat(!jobs.jobs.some((job) => job.name.startsWith(prefix)) || plans.some((entry) => entry.suite === suite.id), `Missing plan for dispatched suite: ${suite.id}`);
        }
        for (const entry of plans) {
            try {
                validatePlan(entry.plan, config, identity, context);
                const query = new URLSearchParams({repository: identity.repository, commit_sha: identity.tested_sha, gh_run_id: identity.run_id, gh_run_attempt: identity.run_attempt, name: entry.suite});
                const base = tsio.href.replace(/\/$/, '');
                const evidence = await read(`${base}/tests/evidence?${query}`);
                requireThat(typeof evidence.group?.id === 'string' && /^[a-f0-9-]{36}$/.test(evidence.group.id), 'Invalid report group ID');
                const detail = await read(`${base}/reports/${evidence.group.id}`);
                const orchestration = await read(`${base}/orchestration/status?${query}`);
                result.suites.push(compareSuite({plan: entry.plan, evidence, detail, orchestration}, {config, identity, jobs, context}));
            } catch (error) {result.suites.push(unavailable(entry.suite, error));}
        }
    } catch (error) {result.suites = [unavailable('comparison-inputs', error)];}
    writeFileSync(resolve(output, 'comparison.json'), JSON.stringify(result, null, 2) + '\n');
    const markdown = summaryMarkdown(result);
    writeFileSync(resolve(output, 'summary.md'), markdown);
    if (env.GITHUB_STEP_SUMMARY) appendFileSync(env.GITHUB_STEP_SUMMARY, markdown);
    return result;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    main().then((result) => process.stdout.write(JSON.stringify({output: resolve(process.env.COMPARISON_OUTPUT), suites: result.suites.map(({suite, status}) => ({suite, status}))}) + '\n')).catch((error) => {process.stderr.write(`Advisory comparison could not write output: ${error.message}\n`); process.exitCode = 1;});
}
