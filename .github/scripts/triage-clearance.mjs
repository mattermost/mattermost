// Finite CI policy: an exact-base failed attempt plus a complete successful verification
// of the unchanged head. This is not a proof that a PR cannot affect flakiness.
import {createHash} from 'node:crypto';
import {appendFile, mkdir, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {inflateRawSync} from 'node:zlib';
import {analyzePR, latestStatuses, readJSON, statusTarget} from './triage-pr.mjs';
import {legacyObservations} from './triage-pr-observations.mjs';
import {digestPattern, invariant as check, main, required, shaPattern, validateWorkflow} from './triage-lib.mjs';

const REPOSITORY = 'mattermost/mattermost';
const WORKFLOW = '.github/workflows/e2e-tests-ci.yml';
const CONTEXT = /^e2e-test\/(cypress|playwright)-full\/(enterprise|fips)$/;
const selectors = ['repository', 'commit_sha', 'gh_run_id', 'gh_run_attempt', 'name'];
const failure = row => row.run_failed === true || row.attempts_failed > 0 || ['failed', 'timedOut', 'interrupted', 'flaky'].includes(row.status);
const positive = value => /^[1-9][0-9]*$/.test(String(value));
const text = value => typeof value === 'string' && value.length > 0;
const sorted = values => [...new Set(values)].sort();
const canonical = value => JSON.stringify(value, function(key, item) {
    return item && typeof item === 'object' && !Array.isArray(item) ? Object.fromEntries(Object.keys(item).sort().map(k => [k, item[k]])) : item;
});
const hash = value => createHash('sha256').update(canonical(value)).digest('hex');
const same = (a, b) => canonical(a) === canonical(b);
const pathOf = (file, framework) => {
    check(text(file) && !file.startsWith('/') && !/[\\\0\r\n]/.test(file) && !file.split('/').includes('..'), 'Invalid raw test file');
    const relative = file.replace(new RegExp(`^e2e-tests/${framework}/`), '').replace(/^\.\//, '');
    return framework === 'playwright' ? relative.replace(/^specs\//, '') : relative;
};
const identity = (row, framework, project) => {
    check(text(row.full_title), 'Missing raw test title');
    check(framework !== 'playwright' || !row.project || row.project === project, 'Conflicting Playwright project');
    return canonical([pathOf(row.file, framework), row.full_title, row.project || project || '']);
};
const terminalErrors = test => {
    const rows = test.rows.filter(row => row.final_execution === true);
    const retry = Math.max(...rows.map(row => row.retry_count));
    const errors = sorted(rows.filter(row => row.retry_count === retry).map(row => row.error_message).filter(text));
    check(errors.length === 1, 'Final failed test has missing or ambiguous error');
    return errors[0];
};
const statusSnapshot = status => ({context: status.context, status_id: status.id, state: status.state, target_url: status.target_url});

async function pages(gh, path, field, max = 30) {
    const rows = [];
    for (let page = 1; page <= max; page++) {
        const result = await gh(`${path}${path.includes('?') ? '&' : '?'}per_page=100&page=${page}`);
        const batch = field ? result[field] : result;
        check(Array.isArray(batch), 'Invalid GitHub pagination'); rows.push(...batch);
        if (batch.length < 100) return rows;
    }
    throw Error('GitHub pagination exceeded completeness bound');
}

// Raw source trust and completeness are independent. The orchestration projection
// supplies the final cross-worker execution; every projected case must also occur
// in the registered worker's raw report. Missing legacy rollups are not successes.
export function inspectEvidence(evidence, {selector, run, branch, prNumber}) {
    const raw = evidence.raw?.data;
    const o = structuredClone(evidence.orchestration?.data);
    check(raw?.schema_version === 1 && raw.complete === true && raw.truncated === false && raw.trusted_source === true,
        'Complete, untruncated, trusted raw evidence is required');
    check(raw.group?.status === 'completed' && text(raw.group.id) && selectors.every(k => String(raw.group[k]) === selector[k]) && raw.group.branch === branch,
        'Raw evidence selector or branch mismatch');
    check(o && selectors.every(k => String(o[k]) === selector[k]) && o.branch === branch &&
        (branch === 'master' ? o.gh_pr_number == null : o.gh_pr_number === prNumber),
        'Orchestration selector or PR binding mismatch');
    const framework = raw.group.framework;
    check(['cypress', 'playwright'].includes(framework) && o.framework === framework && selector.name.startsWith(framework + '-full-'), 'Unsupported evidence framework');
    const master = branch === 'master';
    validateWorkflow(run, REPOSITORY, {master, source: {...selector, source_workflow_sha: raw.source_workflow_sha}});
    const workflow = master ? '.github/workflows/e2e-tests-on-merge.yml' : WORKFLOW;
    check(run.head_branch === 'master' && run.path.split('@')[0] === workflow &&
        raw.source_workflow_ref === `${REPOSITORY}/${workflow}@refs/heads/master`, 'Evidence did not originate from the master workflow');
    const expected = raw.group.total_reports_expected;
    check(Number.isSafeInteger(expected) && expected > 0 && Array.isArray(raw.reports) && raw.reports.length === expected &&
        new Set(raw.reports.map(r => r.id)).size === expected && raw.reports.every(r => text(r.id) && r.status === 'complete' && positive(r.gh_job_id) && text(r.gh_job_name)),
        'Worker report coverage is incomplete or ambiguous');
    check(new Set(raw.reports.map(r => String(r.gh_job_id))).size === expected, 'Duplicate worker job reports');
    const environments = raw.reports.map(report => {
        const env = report.environment_metadata;
        check(env && typeof env === 'object' && !Array.isArray(env), 'Worker environment is missing');
        const {worker_index, ...common} = env;
        check(Number.isSafeInteger(worker_index) && worker_index >= 0, 'Worker index is missing');
        check(env.server === 'onprem' && selector.name === `${framework}-full-${env.server_edition}${master ? '-master' : ''}` &&
            digestPattern.test(env.server_image_digest) && text(env[`${framework}_version`]) && typeof env.retest_on_fail === 'boolean',
        'Immutable server digest or framework environment is missing');
        if (framework === 'playwright') check(text(env.playwright_project) && text(env.browser_version) && Number.isSafeInteger(env.playwright_retries) && env.playwright_retries >= 0,
            'Playwright project/browser/retry environment is missing');
        return common;
    });
    check(environments.every(env => same(env, environments[0])), 'Workers used different environments');
    check(new Set(raw.reports.map(r => r.environment_metadata.worker_index)).size === expected, 'Duplicate worker indexes');
    const environment = environments[0]; const project = framework === 'playwright' ? environment.playwright_project : '';
    check(Array.isArray(raw.tests) && raw.tests.length > 0 && new Set(raw.tests.map(t => t.id)).size === raw.tests.length, 'Raw test rows are missing or duplicated');
    const reports = new Map(raw.reports.map(r => [r.id, r]));
    const rawRows = new Set(); const chains = new Map(); const manifest = new Set(); const failedIdentities = new Set();
    for (const row of raw.tests) {
        check(text(row.id) && reports.has(row.report_id) && Number.isSafeInteger(row.retry_count) && row.retry_count >= 0 &&
            typeof row.run_failed === 'boolean' && Number.isSafeInteger(row.attempts) && row.attempts >= 1 &&
            Number.isSafeInteger(row.attempts_failed) && row.attempts_failed >= 0 && row.attempts_failed <= row.attempts &&
            ['passed', 'failed', 'flaky', 'skipped', 'pending', 'timedOut', 'interrupted'].includes(row.status), 'Unknown raw test outcome/attempt metadata');
        const id = identity(row, framework, project); manifest.add(id);
        if (failure(row)) failedIdentities.add(id);
        rawRows.add(canonical([String(reports.get(row.report_id).gh_job_id), id, row.retry_count, row.status, row.error_message || '']));
        const workerIdentity = canonical([String(reports.get(row.report_id).gh_job_id), id]);
        if (!chains.has(workerIdentity)) chains.set(workerIdentity, []);
        chains.get(workerIdentity).push(row);
    }
    for (const chain of chains.values()) {
        chain.sort((a,b) => a.retry_count - b.retry_count);
        const failedCount = chain.filter(r => ['failed', 'timedOut', 'interrupted'].includes(r.status)).length;
        check(chain.every((row, index) => row.retry_count === index && row.attempts === chain.length && row.attempts_failed === failedCount &&
            row.run_failed === (failedCount === chain.length)) && new Set(chain.map(r => r.stable_key || '')).size === 1,
        'Raw retry chain is incomplete, ambiguous or inconsistent');
    }
    const remainingRows = new Set(rawRows); const remainingChains = new Set(chains.keys());
    // Project-less orchestration rows can be disambiguated only by the uniform,
    // registered Playwright project above, never by test title or stable ID.
    const allOrchestrated = new Set(); const finalSkipped = new Set();
    check(Array.isArray(o.units), 'Dispatch units missing');
    for (const unit of o.units) {
        unit.spec_path = pathOf(unit.spec_path, framework);
        check(Array.isArray(unit.attempts) && unit.attempts.length > 0, 'Dispatch attempt missing');
        for (const attempt of unit.attempts) {
            attempt.spec_path = pathOf(attempt.spec_path, framework);
            check(Array.isArray(attempt.test_cases), 'Dispatch test cases missing');
            if (!attempt.test_cases.length) {
                check(unit.state === 'completed_skipped' && attempt.status === 'skipped' && attempt.reported_at === unit.outcome_set_at,
                    'Empty dispatch is not a final skipped spec');
                finalSkipped.add(`empty-spec:${unit.spec_path}`);
            }
            const cases = new Map();
            for (const row of attempt.test_cases) {
                const id = identity({...row, file: unit.spec_path}, framework, project);
                row.project ||= project || null;
                if (framework === 'cypress') {
                    // Cypress dispatch summarizes one test's entire worker retry
                    // chain. Validate that summary against raw attempts, then use
                    // the last actual failure error for the base comparison.
                    const key = canonical([String(attempt.gh_job_id), id]); const chain = chains.get(key);
                    check(chain?.length, 'Cypress worker retry chain is missing');
                    check(remainingChains.delete(key), 'Cypress worker retry chain was consumed more than once');
                    const last = chain.at(-1); const firstFailed = chain.find(r => r.status === 'failed');
                    const status = last.status === 'passed' && firstFailed ? 'flaky' : last.status === 'pending' ? 'skipped' : last.status;
                    check(row.retry_count === chain.length - 1 && row.status === status &&
                        (row.error_message || '') === (firstFailed?.error_message || last.error_message || ''), 'Cypress dispatch summary differs from raw attempts');
                    row.error_message = last.error_message || '';
                } else check(remainingRows.delete(canonical([String(attempt.gh_job_id), id, row.retry_count, row.status, row.error_message || ''])),
                    'Orchestration case is not present in the registered worker report');
                allOrchestrated.add(id);
                if (!cases.has(id) || cases.get(id).retry_count < row.retry_count) cases.set(id, row);
            }
            if (attempt.reported_at === unit.outcome_set_at) for (const [id, row] of cases) {
                if (['skipped', 'pending'].includes(row.status)) finalSkipped.add(id);
            }
        }
    }
    check(framework === 'cypress' ? remainingChains.size === 0 : remainingRows.size === 0,
        'Orchestration omitted raw worker executions or retries');
    check(same(sorted(manifest), sorted(allOrchestrated)), 'Raw and dispatch test manifests differ');
    const observations = legacyObservations(null, o);
    const handled = new Set(['legacy_worker_report_completeness_unverified', 'legacy_consolidated_identity_unverified',
        'legacy_report_group_id_unavailable', 'legacy_consolidated_run_id_requires_request_binding']);
    check(observations.reasons.every(r => handled.has(r)), `Dispatch final outcomes are incomplete: ${observations.reasons.filter(r => !handled.has(r)).join(', ')}`);
    check(same(sorted(failedIdentities), sorted(observations.tests.map(t => identity(t, framework, project)))), 'Raw failed-attempt identities are not fully resolved by orchestration');
    const failures = observations.tests.filter(t => t.observation === 'final_failure').map(t => ({identity: identity(t, framework, project), error: terminalErrors(t)})).sort((a,b) => a.identity.localeCompare(b.identity));
    const outcomes = new Map(observations.tests.map(t => [identity(t, framework, project), t.observation]));
    const failedAttempts = raw.tests.filter(t => ['failed', 'timedOut', 'interrupted'].includes(t.status) && text(t.error_message)).map(t => {
        const id = identity(t, framework, project);
        return {identity: id, error: t.error_message, report_id: t.report_id, raw_row_id: t.id, retry_count: t.retry_count,
            final_outcome: outcomes.get(id)};
    }).sort((a,b) => canonical(a).localeCompare(canonical(b)));
    check(Number.isFinite(Date.parse(raw.group.created_at)), 'Report creation time is missing');
    return {selector, group_id: raw.group.id, created_at: raw.group.created_at, source_workflow_sha: raw.source_workflow_sha,
        source_conclusion: run.conclusion, environment,
        report_count: expected, manifest: sorted(manifest), units: sorted(o.units.map(u => u.spec_path)), skipped: sorted(finalSkipped),
        failures, failed_attempts: failedAttempts, failed_identities: sorted(failedIdentities),
        retry_survivors: observations.tests.filter(t => t.observation === 'retry_survivor').map(t => identity(t, framework, project)).sort()};
}

function suiteSnapshot(inspected) {
    const {manifest, units, skipped, environment, ...rest} = inspected;
    // A verification pulls the same digest explicitly; its display image changes
    // from repo:tag to repo@digest, without changing the recorded immutable image.
    const {server_image, ...settings} = environment;
    return {...rest, manifest_sha256: hash(manifest), units_sha256: hash(units), skipped_sha256: hash(skipped), environment_sha256: hash(settings)};
}

export async function createPlan({repository, number, sourceRunID, expectedSourceAttempt, gh, read = readJSON}) {
    check(repository === REPOSITORY && positive(sourceRunID), 'Invalid clearance repository/source run');
    const analysis = await analyzePR({repository, number, gh, read});
    check(analysis.state === 'open' && analysis.base_branch === 'master' && shaPattern.test(analysis.head_sha) && shaPattern.test(analysis.base_sha) && analysis.diff.complete,
        'An open master PR and its complete textual diff are required');
    check(!analysis.limitations.some(l => l.startsWith('Check-run inventory unavailable')), 'E2E check inventory is unavailable');
    const statuses = analysis.statuses.sort((a,b) => a.context.localeCompare(b.context));
    check(statuses.length >= 2 && statuses.length <= 4 && statuses.every(s => CONTEXT.test(s.context) && ['success', 'failure', 'error'].includes(s.state) &&
        Number.isSafeInteger(s.id) && s.id > 0 && s.creator?.login === 'github-actions[bot]'), 'Unknown, pending, unsupported or untrusted E2E status');
    const requireFips = statuses.some(s => s.context.endsWith('/fips'));
    const requiredContexts = ['cypress', 'playwright'].flatMap(f => (requireFips ? ['enterprise', 'fips'] : ['enterprise']).map(e => `e2e-test/${f}-full/${e}`)).sort();
    check(same(statuses.map(s => s.context).sort(), requiredContexts), 'Missing required Cypress/Playwright coverage');
    const failed = statuses.filter(s => s.state !== 'success');
    check(failed.length > 0 && failed.every(s => statusTarget(s).runID === String(sourceRunID)), 'All failed contexts must belong to the selected source run');
    for (const c of analysis.checks) {
        check(c.status === 'completed' && ['success', 'neutral', 'skipped', 'failure'].includes(c.conclusion), 'Pending or unsupported E2E check run');
        if (c.conclusion === 'failure') {
            const url = new URL(c.details_url);
            check(url.origin === 'https://github.com' && new RegExp(`^/${REPOSITORY}/actions/runs/${sourceRunID}/job/[1-9][0-9]*$`).test(url.pathname),
                'Failed E2E check belongs to an unhandled workflow run');
        }
    }
    const contexts = []; const serverImages = Object.fromEntries(['cypress', 'playwright'].flatMap(f => ['enterprise', 'fips'].map(e => [`${f}_${e}_image`, ''])));
    for (const status of statuses) {
        const suite = analysis.suites.find(s => s.status.context === status.context);
        check(suite && !suite.error, `Source suite unavailable: ${suite?.error || status.context}`);
        const target = statusTarget(status);
        const run = await gh(`/actions/runs/${suite.selector.gh_run_id}`);
        const inspected = inspectEvidence(suite, {selector: suite.selector, run, branch: target.branch, prNumber: analysis.pr_number});
        const [, framework, edition] = CONTEXT.exec(status.context);
        serverImages[`${framework}_${edition}_image`] = inspected.environment.server_image_digest;
        let baseline = null;
        if (status.state !== 'success') {
            check(run.conclusion === 'failure' && inspected.failures.length > 0, 'Failed status lacks a final failed test in a failed workflow');
            const b = suite.baseline;
            check(b?.available && b.relationship === 'exact_pr_base' && b.selector.commit_sha === analysis.base_sha, 'A complete exact-current-base comparison is required');
            const baselineRun = await gh(`/actions/runs/${b.selector.gh_run_id}`);
            const baselineEvidence = inspectEvidence(b, {selector: b.selector, run: baselineRun, branch: 'master'});
            const matchedAttempts = inspected.failures.map(f => {
                const matches = baselineEvidence.failed_attempts.filter(bf => bf.identity === f.identity && bf.error === f.error &&
                    ['final_failure', 'retry_survivor'].includes(bf.final_outcome));
                check(matches.length > 0, 'Original final failure does not match an actual failed attempt on the exact base');
                return {source_failure: f, base_attempts: matches};
            });
            // The product differs at B. Compare recorded test/service settings;
            // this does not assert that the base and head binaries are identical.
            const settings = env => Object.fromEntries(Object.entries(env).filter(([k]) => !/^server_image(?:_|$)/.test(k)));
            check(same(settings(inspected.environment), settings(baselineEvidence.environment)), 'Base test environments are not comparable');
            baseline = {...suiteSnapshot(baselineEvidence), matched_attempts: matchedAttempts};
        } else check(inspected.failures.length === 0, 'Green status hides a final failed test');
        contexts.push({...statusSnapshot(status), origin: target.origin, branch: target.branch,
            evidence: suiteSnapshot(inspected), baseline});
    }
    const source = contexts.filter(c => c.state !== 'success');
    check(new Set(source.map(c => c.evidence.selector.gh_run_attempt)).size === 1, 'Mixed original source attempts');
    if (expectedSourceAttempt !== undefined) check(positive(expectedSourceAttempt) && String(expectedSourceAttempt) === source[0].evidence.selector.gh_run_attempt, 'Original source attempt changed');
    return {schema_version: 1, policy: 'exact-base-attempt-full-head-verification-v1', repository, pr_number: analysis.pr_number,
        head_sha: analysis.head_sha, base_sha: analysis.base_sha, head_repository: analysis.head_repository,
        source_run_id: String(sourceRunID), source_run_attempt: source[0].evidence.selector.gh_run_attempt,
        diff_sha256: hash(analysis.diff), checks: analysis.checks.sort((a,b) => a.id - b.id),
        contexts, failed_contexts: failed.map(s => s.context), require_fips: requireFips, server_images: serverImages};
}

// Actions artifacts are data. Never extract paths to disk or execute their files.
export function planFromZIP(bytes) {
    check(Buffer.isBuffer(bytes) && bytes.length <= 4 * 1024 * 1024 && bytes.length >= 22, 'Invalid plan archive size');
    let end = -1;
    for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
        if (bytes.readUInt32LE(i) === 0x06054b50 && i + 22 + bytes.readUInt16LE(i + 20) === bytes.length) {end = i; break;}
    }
    check(end >= 0 && bytes.readUInt16LE(end + 4) === 0 && bytes.readUInt16LE(end + 6) === 0 &&
        bytes.readUInt16LE(end + 8) === 1 && bytes.readUInt16LE(end + 10) === 1, 'Plan archive must contain exactly one file');
    const offset = bytes.readUInt32LE(end + 16); const size = bytes.readUInt32LE(end + 12);
    check(offset + size === end && size >= 46 && offset + 46 <= end && bytes.readUInt32LE(offset) === 0x02014b50, 'Invalid plan archive directory');
    const flags = bytes.readUInt16LE(offset + 8); const method = bytes.readUInt16LE(offset + 10);
    const compressed = bytes.readUInt32LE(offset + 20); const length = bytes.readUInt32LE(offset + 24);
    const nameLength = bytes.readUInt16LE(offset + 28); const extraLength = bytes.readUInt16LE(offset + 30); const commentLength = bytes.readUInt16LE(offset + 32);
    const local = bytes.readUInt32LE(offset + 42);
    check((flags & 1) === 0 && [0, 8].includes(method) && length <= 1024 * 1024 && length > 0 && compressed <= 4 * 1024 * 1024 &&
        bytes.readUInt16LE(offset + 34) === 0 && offset + 46 + nameLength + extraLength + commentLength === end &&
        bytes.subarray(offset + 46, offset + 46 + nameLength).toString('utf8') === 'plan.json', 'Unsupported or oversized plan archive entry');
    check(local + 30 <= offset && bytes.readUInt32LE(local) === 0x04034b50 && bytes.readUInt16LE(local + 8) === method &&
        bytes.readUInt16LE(local + 6) === flags, 'Invalid plan archive local header');
    const localName = bytes.readUInt16LE(local + 26); const localExtra = bytes.readUInt16LE(local + 28);
    const data = local + 30 + localName + localExtra;
    check(data + compressed <= offset && bytes.subarray(local + 30, local + 30 + localName).toString('utf8') === 'plan.json', 'Invalid plan archive payload');
    const packed = bytes.subarray(data, data + compressed);
    const unpacked = method === 8 ? inflateRawSync(packed, {maxOutputLength: 1024 * 1024}) : packed;
    check(unpacked.length === length, 'Truncated plan archive payload');
    return JSON.parse(unpacked.toString('utf8'));
}

async function downloadArtifact(path, token, fetcher = fetch) {
    check(/^\/actions\/artifacts\/[1-9][0-9]*\/zip$/.test(path) && text(token), 'Invalid artifact download request');
    const response = await fetcher(`https://api.github.com/repos/${REPOSITORY}${path}`, {redirect: 'manual',
        signal: AbortSignal.timeout(30000), headers: {Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json'}});
    check(response.status === 302, 'Artifact download redirect unavailable');
    const target = new URL(response.headers.get('location'));
    check(target.protocol === 'https:' && !target.username && !target.password, 'Invalid signed artifact URL');
    // The signed URL is returned by GitHub. The token is deliberately not forwarded.
    const archive = await fetcher(target, {redirect: 'error', signal: AbortSignal.timeout(30000)});
    check(archive.ok, 'Artifact download failed');
    const chunks = []; let size = 0; const reader = archive.body.getReader();
    try {
        while (true) {const {done, value} = await reader.read(); if (done) break; size += value.length; check(size <= 4 * 1024 * 1024, 'Plan archive exceeds size bound'); chunks.push(value);}
    } finally {await reader.cancel();}
    return Buffer.concat(chunks);
}

async function verificationRun(gh, id) {
    const run = await gh(`/actions/runs/${id}`);
    validateWorkflow(run, REPOSITORY);
    check(String(run.id) === String(id) && run.path.split('@')[0] === WORKFLOW && run.head_branch === 'master' &&
        run.event === 'workflow_dispatch' && run.conclusion === 'success' && run.run_attempt === 1,
        'Verification must be the first completed successful master workflow dispatch');
    return run;
}

export async function finalize({repository, verificationRunID, gh, read = readJSON,
    download = path => downloadArtifact(path, process.env.GH_TOKEN), controller = process.env}) {
    check(repository === REPOSITORY && positive(verificationRunID), 'Invalid verification run');
    check(controller.MM_TRIAGE_SET_STATUS === 'true' && controller.GITHUB_REF === 'refs/heads/master' &&
        controller.GITHUB_WORKFLOW_REF === `${REPOSITORY}/.github/workflows/e2e-triage-shadow.yml@refs/heads/master` && shaPattern.test(controller.GITHUB_SHA),
        'Automatic writes require the enabled master triage controller');
    const run = await verificationRun(gh, verificationRunID);
    const artifacts = await pages(gh, `/actions/runs/${run.id}/artifacts`, 'artifacts');
    const matches = artifacts.filter(a => a.name === `clearance-plan-${run.id}-${run.run_attempt}`);
    check(matches.length === 1 && !matches[0].expired && positive(matches[0].id), 'Exactly one nonexpired verification plan artifact is required');
    const bytes = await download(`/actions/artifacts/${matches[0].id}/zip`);
    if (matches[0].digest) check(matches[0].digest === `sha256:${createHash('sha256').update(bytes).digest('hex')}`, 'GitHub plan artifact digest mismatch');
    const stored = planFromZIP(bytes);
    check(stored?.schema_version === 1 && stored.repository === repository && positive(stored.pr_number) && positive(stored.source_run_id) &&
        stored.source_run_id !== String(run.id), 'Invalid stored plan identity');
    const marker = `<!-- TSIO_E2E_CLEARANCE_V1 verification=${run.id}/1 -->`;
    const comments = await pages(gh, `/issues/${stored.pr_number}/comments`);
    const previous = comments.filter(c => c.user?.login === 'github-actions[bot]' && c.body?.startsWith(marker + '\n'));
    if (previous.length) return {already_processed: true, verification_run_id: String(run.id), audit_url: previous[0].html_url,
        note: 'A prior audit claim exists; no status was changed or retried.'};
    const plan = await createPlan({repository, number: stored.pr_number, sourceRunID: stored.source_run_id, gh, read});
    const {checks: originalChecks, ...originalPlan} = stored;
    const {checks: currentChecks, ...currentPlan} = plan;
    check(same(originalPlan, currentPlan), 'Original PR, base, status, run or evidence changed after the verification plan');
    check(Array.isArray(originalChecks) && originalChecks.every(c => currentChecks.some(fresh => same(c, fresh))) && currentChecks.every(c =>
        originalChecks.some(old => same(old, c)) || c.status === 'completed' && c.conclusion === 'success' &&
        typeof c.details_url === 'string' && new RegExp(`^https://github\\.com/${REPOSITORY}/actions/runs/${run.id}/job/[1-9][0-9]*$`).test(c.details_url)),
    'E2E check inventory changed outside the successful verification run');
    const configured = new URL(controller.TSIO_URL || 'https://test-io.test.mattermost.com/api/v1');
    check(['https://test-io.test.mattermost.com', 'https://staging-test-io.test.mattermost.com'].includes(configured.origin) &&
        configured.pathname.replace(/\/$/, '') === '/api/v1' && !configured.search && !configured.hash && !configured.username && !configured.password &&
        plan.contexts.every(c => c.origin === configured.origin), 'Plan evidence is outside the activated TSIO origin');
    check(Number.isFinite(Date.parse(run.created_at)) && plan.contexts.every(c => Date.parse(run.created_at) > Date.parse(c.evidence.created_at || '')), 'Verification ordering is unavailable');
    const verified = [];
    for (const context of plan.contexts) {
        const selector = {...context.evidence.selector, gh_run_id: String(run.id), gh_run_attempt: String(run.run_attempt)};
        const query = new URLSearchParams(selector); const base = context.origin + '/api/v1';
        const [raw, orchestration] = await Promise.all([read(`${base}/triage/run-evidence?${query}`), read(`${base}/orchestration/status?${query}`)]);
        const evidence = inspectEvidence({raw: {data: raw}, orchestration: {data: orchestration}}, {selector, run, branch: context.branch, prNumber: plan.pr_number});
        const snapshot = suiteSnapshot(evidence); const source = context.evidence;
        check(evidence.failures.length === 0 && evidence.failed_identities.every(id => source.failed_identities.includes(id)), 'Verification has a final or newly observed failed test');
        check(['manifest_sha256', 'units_sha256', 'skipped_sha256', 'environment_sha256', 'report_count', 'source_workflow_sha'].every(k => snapshot[k] === source[k]),
            'Verification changed test coverage, skips, worker count or recorded environment');
        verified.push(snapshot);
    }
    const expected = new Map(plan.contexts.map(c => [c.context, c.status_id]));
    let savedAudit;
    const fresh = async () => {
        const pr = await gh(`/pulls/${plan.pr_number}`);
        check(pr.number === plan.pr_number && pr.base?.repo?.full_name === repository && pr.state === 'open' && pr.base.ref === 'master' &&
            pr.head.sha === plan.head_sha && pr.base.sha === plan.base_sha && pr.head.repo?.full_name === plan.head_repository,
            'PR head, base, repository or state changed');
        const currentRun = await verificationRun(gh, run.id);
        check(currentRun.head_sha === run.head_sha, 'Verification source workflow SHA changed');
        for (const context of plan.contexts) {
            for (const evidence of [context.evidence, context.baseline].filter(Boolean)) {
                const source = await gh(`/actions/runs/${evidence.selector.gh_run_id}`);
                validateWorkflow(source, repository, {master: evidence === context.baseline,
                    source: {...evidence.selector, source_workflow_sha: evidence.source_workflow_sha}});
                check(source.head_branch === 'master' && source.conclusion === evidence.source_conclusion, 'Original or base workflow ref or conclusion changed');
            }
        }
        const statuses = latestStatuses(await pages(gh, `/commits/${plan.head_sha}/statuses`));
        check(statuses.length === plan.contexts.length && statuses.every(s => expected.get(s.context) === s.id), 'Latest E2E status scope changed');
        const checks = (await pages(gh, `/commits/${plan.head_sha}/check-runs?filter=latest`, 'check_runs')).filter(c => /e2e|cypress|playwright/i.test(c.name))
            .map(c => ({id: c.id, name: c.name, status: c.status, conclusion: c.conclusion, details_url: c.details_url})).sort((a,b) => a.id - b.id);
        check(same(checks, plan.checks), 'E2E check-run scope changed');
        if (savedAudit) {
            const current = await gh(`/issues/comments/${savedAudit.id}`);
            check(current.body === savedAudit.body && current.html_url === savedAudit.html_url && current.user?.login === 'github-actions[bot]',
                'Saved clearance audit was edited, removed or replaced');
        }
        return statuses;
    };
    await fresh();
    const audit = {policy: plan.policy, plan_sha256: hash(plan), plan, verification_run_id: String(run.id), verification_run_attempt: 1,
        verification_workflow_sha: run.head_sha, verified, controller_sha: controller.GITHUB_SHA};
    const body = `${marker}\nMatching failed attempt observed on the exact PR base; full unchanged head re-verified successfully. Normal CI retries are preserved. This finite CI policy does not prove that the PR cannot affect failure probability.\n\nThe following audit is saved before any status change.\n\n\`\`\`json\n${JSON.stringify(audit, null, 2).replaceAll('<', '\\u003c')}\n\`\`\``;
    check(body.length < 60000, 'Clearance audit exceeds GitHub comment limit');
    const comment = await gh(`/issues/${plan.pr_number}/comments`, {body});
    check(positive(comment.id) && comment.html_url === `https://github.com/${repository}/pull/${plan.pr_number}#issuecomment-${comment.id}`, 'Audit write was not confirmed');
    const saved = await gh(`/issues/comments/${comment.id}`);
    check(saved.body === body && saved.html_url === comment.html_url && saved.user?.login === 'github-actions[bot]', 'Stored audit differs from submitted audit');
    savedAudit = {...comment, body};
    const description = `Base failure matched; full head verified (${comment.id})`;
    const attempted = []; const written = [];
    try {
        for (const context of plan.contexts.filter(c => plan.failed_contexts.includes(c.context))) {
            await fresh();
            const item = {context: context.context}; attempted.push(item);
            const status = await gh(`/statuses/${plan.head_sha}`, {state: 'success', context: context.context, description, target_url: comment.html_url});
            check(positive(status.id) && status.state === 'success' && status.context === context.context, 'Success status write was not confirmed');
            item.written_id = status.id; expected.set(context.context, status.id); written.push({context: context.context, status_id: status.id});
            await fresh();
        }
        await fresh();
    } catch (error) {
        const restored = []; const uncertain = [];
        for (const item of attempted) {
            try {
                const current = latestStatuses(await pages(gh, `/commits/${plan.head_sha}/statuses`)).find(s => s.context === item.context);
                if (current?.state !== 'success' || current.description !== description || current.target_url !== comment.html_url ||
                    current.creator?.login !== 'github-actions[bot]' || (item.written_id && current.id !== item.written_id)) {
                    check(item.written_id, 'Unacknowledged status write may still complete'); continue;
                }
                const original = plan.contexts.find(c => c.context === item.context);
                const status = await gh(`/statuses/${plan.head_sha}`, {state: original.state, context: item.context,
                    description: 'Verification invalidated; inspect clearance audit', target_url: comment.html_url});
                check(positive(status.id) && status.context === item.context && status.state === original.state, 'Restoration was not confirmed');
                restored.push(item.context);
            } catch {uncertain.push(item.context);}
        }
        if (uncertain.length) throw Error(`Status may be green for ${uncertain.join(', ')}; restoration uncertain after ${error.message}; inspect ${comment.html_url}`);
        throw Error(`${restored.length ? 'Owned statuses restored' : 'No owned status remains to restore'}: ${error.message}`);
    }
    const receipt = {audit_url: comment.html_url, head_sha: plan.head_sha, base_sha: plan.base_sha, verification_run_id: String(run.id), statuses: written};
    try {
        await gh(`/issues/${plan.pr_number}/comments`, {body: `E2E verification statuses applied and read back on \`${plan.head_sha}\`. [Recorded evidence](${comment.html_url})\n\n\`\`\`json\n${JSON.stringify(receipt, null, 2)}\n\`\`\``});
    } catch {
        throw Error(`Verified statuses were applied; the receipt comment could not be confirmed. Inspect ${comment.html_url}; do not repeat writes.`);
    }
    return receipt;
}

main(import.meta.url, async () => {
    const repository = required(process.env, 'GITHUB_REPOSITORY'); const token = required(process.env, 'GH_TOKEN');
    const gh = async (path, body) => {
        check(path.startsWith('/') && !path.startsWith('//'), 'Invalid GitHub API path');
        if (body === undefined) return readJSON(`https://api.github.com/repos/${repository}${path}`, token);
        const response = await fetch(`https://api.github.com/repos/${repository}${path}`, {method: 'POST', redirect: 'error', signal: AbortSignal.timeout(30000),
            headers: {Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json'}, body: JSON.stringify(body)});
        check(response.ok, `GitHub write failed (${response.status})`); return response.json();
    };
    if (process.env.TRIAGE_MODE === 'plan') {
        const plan = await createPlan({repository, number: required(process.env, 'PR_NUMBER'), sourceRunID: required(process.env, 'TRIAGE_SOURCE_RUN_ID'),
            expectedSourceAttempt: required(process.env, 'TRIAGE_SOURCE_RUN_ATTEMPT'), gh});
        const dir = required(process.env, 'TRIAGE_ARTIFACTS'); await mkdir(dir, {recursive: true}); await writeFile(join(dir, 'plan.json'), JSON.stringify(plan, null, 2));
        if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `require_fips=${plan.require_fips}\n${Object.entries(plan.server_images).map(([key, value]) => `${key}=${value}`).join('\n')}\n`);
        console.log(`Eligible verification plan saved for PR #${plan.pr_number}; no status changes.`);
    } else {
        check(process.env.TRIAGE_MODE === 'finalize', 'TRIAGE_MODE must be plan or finalize');
        console.log(JSON.stringify(await finalize({repository, verificationRunID: required(process.env, 'TRIAGE_VERIFICATION_RUN_ID'), gh}), null, 2));
    }
});
