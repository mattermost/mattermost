import {appendFile, mkdir, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {stripVTControlCharacters} from 'node:util';
import {invariant, main, required, shaPattern, validateWorkflow} from './triage-lib.mjs';
import {statusMatches} from './triage-diagnose.mjs';
import {legacyObservations} from './triage-pr-observations.mjs';

const origins = new Set(['https://test-io.test.mattermost.com', 'https://staging-test-io.test.mattermost.com']);
const selectorKeys = ['repository', 'commit_sha', 'gh_run_id', 'gh_run_attempt', 'name'];
const failure = new Set(['failure', 'error', 'timed_out', 'cancelled', 'action_required', 'startup_failure']);
const compact = value => stripVTControlCharacters(String(value ?? '')).replace(/[\x00-\x1f\x7f<>@`|]/g, ' ').slice(0, 500).replace(/[\\[\]()!*_#]/g, '\\$&');

export function prNumber(value) {
    invariant(/^[1-9][0-9]{0,9}$/.test(String(value)), 'pr_number must be a positive integer');
    return Number(value);
}

// This reader never forwards the GitHub token to an evidence URL or follows redirects.
export async function readJSON(url, token, fetcher = fetch) {
    const target = new URL(url);
    invariant(target.protocol === 'https:' && !target.username && !target.password, 'Invalid evidence URL');
    invariant(!token || target.origin === 'https://api.github.com', 'GitHub credentials require the GitHub API origin');
    const response = await fetcher(target, {redirect: 'error', signal: AbortSignal.timeout(30000), headers: {
        Accept: 'application/vnd.github+json', ...(token ? {Authorization: `Bearer ${token}`} : {}),
    }});
    invariant(response.ok, `${target.hostname}${target.pathname}: HTTP ${response.status}`);
    invariant(response.headers.get('content-type')?.includes('json'), `${target.hostname}${target.pathname}: JSON API unavailable`);
    const reader = response.body.getReader(); const chunks = []; let size = 0;
    try {
        while (true) {
            const {done, value} = await reader.read(); if (done) break;
            size += value.length;
            invariant(size <= 20 * 1024 * 1024, 'API response exceeded 20 MiB');
            chunks.push(value);
        }
    } finally { await reader.cancel(); }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

async function pages(gh, path, field, maxPages = 30) {
    const rows = [];
    for (let page = 1; page <= maxPages; page++) {
        const result = await gh(`${path}${path.includes('?') ? '&' : '?'}per_page=100&page=${page}`);
        const batch = field ? result[field] : result;
        invariant(Array.isArray(batch), 'Invalid paginated GitHub response'); rows.push(...batch);
        if (batch.length < 100) return rows;
    }
    throw new Error('GitHub pagination limit reached; complete evidence unavailable');
}

export function latestStatuses(statuses) {
    const latest = new Map();
    // GitHub returns statuses newest first. Keep the first occurrence of each context.
    for (const status of statuses) if (!latest.has(status.context)) latest.set(status.context, status);
    return [...latest.values()].filter(s => /^e2e-test\//.test(s.context));
}

export function statusTarget(status) {
    const match = /^e2e-test\/(cypress|playwright)-full\/(enterprise|fips)$/.exec(status.context);
    invariant(match, 'Unsupported E2E context; no automatic attribution');
    const url = new URL(status.target_url);
    invariant(origins.has(url.origin) && !url.username && !url.password && !url.hash, 'Untrusted TSIO status target');
    for (const [key] of url.searchParams) invariant(['gh_run_id', 'gh_run_attempt'].includes(key) && url.searchParams.getAll(key).length === 1, 'Ambiguous status target parameters');
    const runID = url.searchParams.get('gh_run_id'); const attempt = url.searchParams.get('gh_run_attempt');
    invariant(/^[1-9][0-9]*$/.test(runID) && (attempt === null || /^[1-9][0-9]*$/.test(attempt)), 'Missing or invalid run/attempt link');
    const parts = url.pathname.split('/');
    invariant(parts.length === 6 && parts[1] === 'reports' && parts[2] === 'mattermost', 'Unexpected TSIO report path');
    const branch = decodeURIComponent(parts[3]).replaceAll('~', '/');
    invariant(branch && parts[4].length === 7 && decodeURIComponent(parts[5]) === `${match[1]}-full-${match[2]}`, 'Unexpected TSIO branch, commit or suite path');
    return {origin: url.origin, runID, attempt, branch, shortSHA: parts[4], name: `${match[1]}-full-${match[2]}`};
}

function patchComplete(file) {
    if (typeof file.patch !== 'string') return false;
    const lines = file.patch.split('\n');
    return lines.filter(l => l.startsWith('+')).length === file.additions && lines.filter(l => l.startsWith('-')).length === file.deletions;
}

export function observedTests(raw) {
    if (!raw || !Array.isArray(raw.tests)) return [];
    const grouped = new Map();
    for (const t of raw.tests) {
        const key = JSON.stringify([t.report_id, t.suite_id, t.file, t.full_title, t.project]);
        if (!grouped.has(key)) grouped.set(key, []); grouped.get(key).push(t);
    }
    return [...grouped.values()].flatMap(rows => {
        const first = rows[0];
        const failed = rows.some(t => t.run_failed === true);
        const recovered = rows.every(t => t.run_failed === false) && rows.some(t => t.attempts_failed > 0);
        if (!failed && !recovered && !rows.some(t => ['failed', 'timedOut', 'interrupted', 'flaky'].includes(t.status))) return [];
        const contradictory = rows.some(t => t.run_failed === true) && rows.some(t => t.run_failed === false);
        return [{file: first.file, full_title: first.full_title, project: first.project, stable_key: first.stable_key,
            observation: contradictory ? 'ambiguous_attempts' : failed ? 'failed_worker_execution' : recovered ? 'worker_retry_survivor' : 'legacy_attempts_unknown',
            rows}];
    });
}

async function optional(read, url) {
    try { return {url, available: true, data: await read(url)}; }
    catch (error) { return {url, available: false, reason: error.message}; }
}

function bindGroup(group, selector, branch) {
    invariant(group && selectorKeys.every(k => String(group[k]) === selector[k]) && group.branch === branch,
        'Returned report does not match the requested commit/run/attempt/suite/branch');
}

async function collectEvidence({base, selector, branch, read}) {
    const query = new URLSearchParams(selector);
    const [raw, clustered, orchestration] = await Promise.all([
        optional(read, `${base}/triage/run-evidence?${query}`), optional(read, `${base}/tests/evidence?${query}`), optional(read, `${base}/orchestration/status?${query}`),
    ]);
    const legacyQuery = new URLSearchParams({repository: selector.repository, commit: selector.commit_sha, branch,
        gh_run_id: selector.gh_run_id, run_attempt: selector.gh_run_attempt, name: selector.name});
    const legacy = raw.available ? null : await optional(read, `${base}/reports/consolidated?${legacyQuery}`);
    const observations = legacyObservations(legacy?.data, orchestration.data);
    const group = raw.available ? raw.data.group : clustered.available ? clustered.data.group : observations.group;
    if (group) bindGroup(group, selector, branch);
    if (clustered.available) bindGroup(clustered.data.group, selector, branch);
    if (orchestration.available) bindGroup(orchestration.data, selector, branch);
    let detail = null;
    if (!raw.available && group?.id) {
        invariant(/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(group.id), 'Invalid legacy report group ID');
        detail = await optional(read, `${base}/reports/${group.id}`);
        if (detail.available) {
            bindGroup({...detail.data, commit_sha: detail.data.commit}, selector, branch);
            invariant(detail.data.id === group.id, 'Legacy detail group differs from consolidated group');
        }
    }
    const reports = raw.available ? raw.data.reports : detail?.data?.reports;
    const expected = raw.available ? group?.total_reports_expected : detail?.data?.total_reports_expected;
    const workerReportsComplete = Number.isSafeInteger(expected) && expected > 0 && Array.isArray(reports) &&
        reports.length === expected && new Set(reports.map(r => r.id)).size === expected && reports.every(r => r.status === 'complete');
    const observationLimits = observations.reasons.filter(reason =>
        !(workerReportsComplete && reason === 'legacy_worker_report_completeness_unverified') &&
        !(group && reason === 'legacy_report_group_id_unavailable') &&
        !(raw.available && reason === 'legacy_consolidated_identity_unverified') &&
        reason !== 'legacy_consolidated_run_id_requires_request_binding');
    return {group, raw, clustered, orchestration, legacy, detail, legacy_observations: observations,
        observation_limits: observationLimits,
        worker_reports: {received: reports?.length ?? null, expected: expected ?? null, complete: workerReportsComplete},
        tests: orchestration.available ? observations.tests : raw.available ? observedTests(raw.data) : observations.tests};
}

// Bounded discovery is an observation aid, not a waiver or a complete history search.
async function masterEvidence({suite, pr, repository, gh, read, catalogs}) {
    const base = new URL(suite.raw.url).origin + '/api/v1';
    if (!catalogs.has(base)) catalogs.set(base, (async () => {
        const reports = [];
        for (let offset = 0; offset < 1000; offset += 200) {
            const page = await read(`${base}/reports?limit=200&offset=${offset}`);
            invariant(Array.isArray(page.reports) && Number.isSafeInteger(page.total), 'Invalid report catalog');
            reports.push(...page.reports);
            if (offset + page.reports.length >= page.total) return {reports, truncated: false};
            invariant(page.reports.length > 0, 'Incomplete report catalog page');
        }
        return {reports, truncated: true};
    })());
    const catalog = await catalogs.get(base);
    const before = Date.parse(suite.group?.created_at);
    invariant(Number.isFinite(before), 'PR report timestamp unavailable for prior master comparison');
    const candidates = catalog.reports.filter(g => g.repository === repository && g.branch === 'master' &&
        g.name === suite.selector.name + '-master' && shaPattern.test(g.commit) &&
        g.status === 'completed' && Date.parse(g.created_at) < before && /^[1-9][0-9]*$/.test(String(g.gh_run_id)) && /^[1-9][0-9]*$/.test(String(g.gh_run_attempt)))
        .sort((a, b) => Number(b.commit === pr.base.sha) - Number(a.commit === pr.base.sha) || Date.parse(b.created_at) - Date.parse(a.created_at));
    for (const candidate of candidates.slice(0, 3)) {
        const comparison = candidate.commit === pr.base.sha ? null : await gh(`/compare/${candidate.commit}...${pr.base.sha}?per_page=1`);
        if (comparison && !['ahead', 'identical'].includes(comparison.status)) continue;
        const run = await gh(`/actions/runs/${candidate.gh_run_id}`);
        validateWorkflow(run, repository, {master: true});
        invariant(String(run.id) === String(candidate.gh_run_id) && run.run_attempt === Number(candidate.gh_run_attempt), 'Baseline run attempt changed');
        const selector = {repository, commit_sha: candidate.commit, gh_run_id: String(run.id), gh_run_attempt: String(run.run_attempt), name: candidate.name};
        const evidence = await collectEvidence({base, selector, branch: 'master', read});
        invariant(evidence.group?.id === candidate.id, 'Baseline report differs from selected catalog group');
        if (evidence.raw.data?.trusted_source === true) validateWorkflow(run, repository, {source: {...selector, source_workflow_sha: evidence.raw.data.source_workflow_sha}});
        const fresh = await gh(`/actions/runs/${run.id}`);
        invariant(fresh.run_attempt === run.run_attempt && fresh.head_sha === run.head_sha && fresh.status === run.status && fresh.conclusion === run.conclusion, 'Baseline workflow changed during collection');
        return {available: true, selector, relationship: candidate.commit === pr.base.sha ? 'exact_pr_base' : 'ancestor_of_pr_base',
            catalog_truncated: catalog.truncated, scanned_groups: catalog.reports.length,
            environment_comparability: 'not_established', run: {id: run.id, run_attempt: run.run_attempt, head_sha: run.head_sha, html_url: run.html_url}, ...evidence};
    }
    return {available: false, reason: 'No eligible prior master run among the bounded candidates; missing history does not establish PR causality.',
        scanned_groups: catalog.reports.length, catalog_truncated: catalog.truncated, candidates_examined: Math.min(candidates.length, 3)};
}

export function assessObservations(tests, baseline, files, framework) {
    const changed = new Set(files.flatMap(f => [f.filename, f.previous_filename].filter(Boolean)));
    const finalErrors = test => {
        const rows = test.rows.filter(r => r.final_execution === true);
        const retry = Math.max(...rows.map(r => r.retry_count));
        return rows.filter(r => r.retry_count === retry).map(r => r.error_message).filter(e => typeof e === 'string' && e.trim());
    };
    return tests.map(test => {
        const prefix = `e2e-tests/${framework}/`;
        const path = typeof test.file === 'string' && !test.file.startsWith('/') && !test.file.split('/').includes('..') ?
            test.file.startsWith(prefix) ? test.file : prefix + test.file.replace(/^\.\//, '') : null;
        const errors = new Set(finalErrors(test));
        const matches = baseline?.available && test.file && test.full_title && (framework === 'cypress' || test.project) ?
            baseline.tests.filter(b => b.observation === 'final_failure' && b.file === test.file && b.full_title === test.full_title && b.project === test.project &&
                finalErrors(b).some(e => errors.has(e))) : [];
        const fileChanged = path ? changed.has(path) : null;
        const classification = test.observation === 'retry_survivor' ? 'observed_flaky' :
            test.observation === 'final_failure' && matches.length === 1 ? 'observed_on_master' :
                test.observation === 'final_failure' && fileChanged ? 'pr_suspect' : 'unknown';
        return {...test, repository_file: path, test_file_changed: fileChanged, classification,
            baseline_same_test_and_error: matches.length === 1, cause_proven: false};
    });
}

async function suiteEvidence({status, pr, repository, gh, read}) {
    const target = statusTarget(status); const run = await gh(`/actions/runs/${target.runID}`);
    invariant(target.shortSHA === pr.head.sha.slice(0, 7), 'Status target refers to an older PR commit');
    invariant(!/^pr-[0-9]+$/.test(target.branch) || target.branch === `pr-${pr.number}`, 'Status target belongs to a different PR');
    validateWorkflow(run, repository);
    invariant(String(run.id) === target.runID && run.path.split('@')[0] === '.github/workflows/e2e-tests-ci.yml', 'Not the linked PR E2E workflow');
    // Old producer URLs omit attempt. Only the sole original attempt is unambiguous.
    invariant(target.attempt ? Number(target.attempt) === run.run_attempt : run.run_attempt === 1, 'Status cannot be bound to the current run attempt');
    const selector = {repository, commit_sha: pr.head.sha, gh_run_id: target.runID, gh_run_attempt: String(run.run_attempt), name: target.name};
    const base = target.origin + '/api/v1';
    const evidence = await collectEvidence({base, selector, branch: target.branch, read});
    if (evidence.raw.data?.trusted_source === true) validateWorkflow(run, repository, {source: {...selector, source_workflow_sha: evidence.raw.data.source_workflow_sha}});
    const {group, tests, clustered, detail} = evidence;
    if (group) {
        if (clustered.available) invariant(clustered.data.group.gh_pr_number === pr.number, 'Report belongs to a different PR');
        if (detail?.available) invariant(detail.data.gh_pr_number === pr.number, 'Report belongs to a different PR');
        if (evidence.orchestration.available) invariant(evidence.orchestration.data.gh_pr_number === pr.number, 'Orchestration belongs to a different PR');
        const linked = {...status, target_url: new URL(status.target_url)};
        if (!target.attempt) linked.target_url.searchParams.set('gh_run_attempt', '1');
        invariant(statusMatches({...linked, target_url: String(linked.target_url)}, group, run, base), 'Status path does not identify the returned report');
    }
    const histories = [];
    for (const key of [...new Set(tests.map(t => t.stable_key).filter(Boolean))].slice(0, 20)) {
        const q = new URLSearchParams({test_id: key, repo: repository, framework: group.framework, branch: 'master', baseline: 'true', name: target.name + '-master', before: group.created_at, limit: '20', window: '14d'});
        histories.push({stable_key: key, ...await optional(read, `${base}/tests/history?${q}`)});
    }
    const freshRun = await gh(`/actions/runs/${target.runID}`);
    invariant(freshRun.run_attempt === run.run_attempt && freshRun.head_sha === run.head_sha && freshRun.status === run.status && freshRun.conclusion === run.conclusion, 'Source workflow changed during evidence collection');
    return {status, selector, run: {id: run.id, run_attempt: run.run_attempt, head_sha: run.head_sha, conclusion: run.conclusion, html_url: run.html_url},
        ...evidence, histories,
        history_limit: 20, can_unblock: false};
}

export async function analyzePR({repository, number, gh, read = readJSON}) {
    const n = prNumber(number); const pr = await gh(`/pulls/${n}`);
    invariant(pr.number === n && pr.base?.repo?.full_name === repository && shaPattern.test(pr.head?.sha) && shaPattern.test(pr.base?.sha), 'Invalid PR repository or full commit identity');
    const result = {schema_version: 1, repository, pr_number: n, head_sha: pr.head.sha, base_sha: pr.base.sha, base_branch: pr.base.ref,
        head_repository: pr.head.repo?.full_name ?? null, fork: pr.head.repo?.full_name ? pr.head.repo.full_name !== repository : null, state: pr.state,
        can_unblock: false, causal_diagnosis: 'not_performed', limitations: [], statuses: [], checks: [], suites: []};
    const files = await pages(gh, `/pulls/${n}/files`);
    const patchBytes = Buffer.byteLength(JSON.stringify(files));
    result.diff = {complete: files.length === pr.changed_files && files.every(patchComplete) && patchBytes <= 2 * 1024 * 1024,
        expected_files: pr.changed_files, files: patchBytes <= 2 * 1024 * 1024 ? files : files.map(({patch, ...file}) => file)};
    if (!result.diff.complete) result.limitations.push('Full textual PR diff unavailable (missing/binary/truncated patches or size limit); no causal conclusion.');
    result.statuses = latestStatuses(await pages(gh, `/commits/${pr.head.sha}/statuses`));
    try {
        result.checks = (await pages(gh, `/commits/${pr.head.sha}/check-runs?filter=latest`, 'check_runs')).filter(c => /e2e|cypress|playwright/i.test(c.name)).map(c => ({id: c.id, name: c.name, status: c.status, conclusion: c.conclusion, details_url: c.details_url}));
    } catch (error) { result.limitations.push(`Check-run inventory unavailable: ${error.message}`); }
    const catalogs = new Map();
    for (const status of result.statuses) {
        // A green status can coexist with a failed source workflow or missing uploads.
        if (status.state === 'pending') continue;
        try {
            const suite = await suiteEvidence({status, pr, repository, gh, read});
            if (suite.tests.some(t => t.observation === 'final_failure')) {
                try { suite.baseline = await masterEvidence({suite, pr, repository, gh, read, catalogs}); }
                catch (error) { suite.baseline = {available: false, reason: error.message}; }
            }
            suite.tests = assessObservations(suite.tests, suite.baseline, files, suite.group?.framework);
            result.suites.push(suite);
        }
        catch (error) { result.suites.push({status, can_unblock: false, error: error.message}); }
    }
    if (!result.statuses.some(s => failure.has(s.state))) result.limitations.push('No failing E2E commit status on this head. This does not establish required-check completeness or resolve a failed source workflow.');
    if (result.statuses.some(s => s.state === 'pending')) result.limitations.push('An E2E status is still pending.');
    if (result.checks.some(c => failure.has(c.conclusion))) result.limitations.push('Failed E2E check runs require investigation in addition to commit-status evidence.');
    result.limitations.push('History matches and changed-file overlap do not prove cause. No master culprit commit has been established; reproduction or bisect is required.',
        'No AI causal diagnosis has run. No check was waived and branch-protection requirements were not inferred.');
    const fresh = await gh(`/pulls/${n}`);
    invariant(fresh.head.sha === pr.head.sha && fresh.base.sha === pr.base.sha && fresh.base.ref === pr.base.ref && fresh.state === pr.state, 'PR head, base or state changed during diagnosis');
    const statuses = latestStatuses(await pages(gh, `/commits/${pr.head.sha}/statuses`));
    invariant(JSON.stringify(statuses.map(s => [s.context, s.id, s.state, s.target_url])) === JSON.stringify(result.statuses.map(s => [s.context, s.id, s.state, s.target_url])), 'E2E statuses changed during diagnosis');
    return result;
}

export function renderPR(result) {
    const lines = [`# E2E analysis: ${result.repository} #${result.pr_number}`, '',
        `Head: \`${result.head_sha}\` · base: \`${result.base_sha}\` · ${result.fork === null ? 'head repository unavailable' : result.fork ? 'fork PR' : 'same-repository PR'}`, '',
        '**Evidence collection only. Causal diagnosis has not run; no status changes.**', '',
        `PR diff: ${result.diff.files.length}/${result.diff.expected_files} files; complete textual patches: ${result.diff.complete}.`, '',
        '| Current E2E context | State |', '| --- | --- |', ...result.statuses.map(s => `| ${compact(s.context)} | ${compact(s.state)} |`)];
    for (const suite of result.suites) {
        lines.push('', `## ${compact(suite.status.context)}`);
        if (suite.error) { lines.push(compact(suite.error)); continue; }
        lines.push(`Run ${suite.run.id}, attempt ${suite.run.run_attempt}.`);
        if (suite.status.state === 'success' && failure.has(suite.run.conclusion)) lines.push("**The overall E2E workflow failed; this suite's commit status is green.**");
        lines.push(`Worker reports: ${suite.worker_reports.received ?? 'unknown'}/${suite.worker_reports.expected ?? 'unknown'}; all received and complete: ${suite.worker_reports.complete}.`);
        lines.push(`Raw evidence complete: ${suite.raw.data?.complete === true}; trusted source: ${suite.raw.data?.trusted_source === true}.`);
        for (const key of ['raw', 'clustered', 'orchestration', 'legacy', 'detail']) if (suite[key]) lines.push(`- ${key}: ${suite[key].available ? 'available in JSON artifact' : compact(suite[key].reason)}`);
        if (suite.observation_limits.length) lines.push(`Observation limits: ${suite.observation_limits.map(compact).join(', ')}.`);
        if (suite.baseline) lines.push(suite.baseline.available ? `Master comparison: ${suite.baseline.relationship}, commit \`${suite.baseline.selector.commit_sha}\`, run ${suite.baseline.run.id}/${suite.baseline.run.run_attempt}. Environment comparability has not been established; this does not prove a culprit commit or PR innocence.` : `Master comparison unavailable: ${compact(suite.baseline.reason)}`);
        for (const test of suite.tests.slice(0, 30)) {
            lines.push(`- ${compact(test.file)} — ${compact(test.full_title)}: **${test.observation}**; assessment: **${test.classification}**; test file changed: ${test.test_file_changed ?? 'unknown'}.`);
            const errorRows = test.observation === 'final_failure' ? test.rows.filter(r => r.final_execution === true).sort((a,b) => b.retry_count - a.retry_count) : test.rows;
            const error = errorRows.find(r => r.error_message)?.error_message;
            if (error) lines.push(`  ${test.observation === 'final_failure' ? 'Final error' : 'Observed failed-attempt error'}: ${compact(error)}`);
        }
        if (suite.tests.length > 30) lines.push(`${suite.tests.length - 30} further identities are in the artifact.`);
    }
    lines.push('', '## Limits', ...result.limitations.map(l => `- ${compact(l)}`), '');
    return lines.join('\n');
}

main(import.meta.url, async () => {
    const repository = required(process.env, 'GITHUB_REPOSITORY');
    invariant(repository === 'mattermost/mattermost', 'This workflow analyzes mattermost/mattermost PRs');
    const token = required(process.env, 'GH_TOKEN');
    const result = await analyzePR({repository, number: required(process.env, 'PR_NUMBER'), gh: path => readJSON(`https://api.github.com/repos/${repository}${path}`, token)});
    const output = process.env.TRIAGE_ARTIFACTS || join(process.env.RUNNER_TEMP || '/tmp', 'pr-triage');
    await mkdir(output, {recursive: true});
    await writeFile(join(output, 'analysis.json'), JSON.stringify(result, null, 2));
    await writeFile(join(output, 'analysis.md'), renderPR(result));
    if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, renderPR(result));
    console.log(`PR #${result.pr_number}: ${result.suites.length} linked E2E contexts; evidence saved to ${output}; no status writes.`);
});
