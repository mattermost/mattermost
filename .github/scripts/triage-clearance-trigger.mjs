import {createHash} from 'node:crypto';
import {appendFile} from 'node:fs/promises';
import {createPlan, finalize} from './triage-clearance.mjs';
import {invariant, main, request, required, shaPattern, validateWorkflow} from './triage-lib.mjs';
import {readJSON, prNumber} from './triage-pr.mjs';

const repository = 'mattermost/mattermost';
const numeric = value => /^[1-9][0-9]*$/.test(String(value));
const apiURLs = new Set(['https://test-io.test.mattermost.com/api/v1', 'https://staging-test-io.test.mattermost.com/api/v1']);
export function evidenceAPI(value) {
    invariant(apiURLs.has(value), 'Choose the exact production or staging Test System IO API URL');
    return value;
}

async function pages(gh, path, field) {
    const result = [];
    for (let page = 1; page <= 20; page++) {
        const response = await gh(`${path}${path.includes('?') ? '&' : '?'}per_page=100&page=${page}`);
        const batch = field ? response[field] : response;
        invariant(Array.isArray(batch), 'Invalid paginated GitHub response');
        result.push(...batch);
        if (batch.length < 100) return result;
    }
    throw Error('GitHub listing is incomplete; automatic re-verification stopped');
}

// Discovery provides a candidate number only. createPlan independently binds
// the current PR, statuses and trusted original/base reports before any dispatch.
export async function discoverPR(run, {read, base}) {
    const numbers = new Set();
    for (let offset = 0; offset < 1000; offset += 200) {
        const page = await read(`${base}/reports?limit=200&offset=${offset}`);
        invariant(Array.isArray(page.reports) && Number.isSafeInteger(page.total), 'Invalid report catalog');
        for (const group of page.reports) {
            if (group.repository !== repository || String(group.gh_run_id) !== String(run.id) ||
                String(group.gh_run_attempt) !== String(run.run_attempt)) continue;
            const number = group.gh_pr_number ?? /^pr-([1-9][0-9]*)$/.exec(group.branch)?.[1];
            if (number !== undefined && number !== null) numbers.add(prNumber(number));
        }
        invariant(numbers.size <= 1, 'Source run has conflicting PR identities');
        if (numbers.size === 1) return [...numbers][0];
        if (offset + page.reports.length >= page.total) return null;
        invariant(page.reports.length > 0, 'Empty page before the end of the report catalog');
    }
    throw Error('No PR located in 1000 recent report groups; analyze the PR by number');
}

export async function handleRun({runID, gh, read = readJSON, base, number, plan = createPlan, finish = finalize}) {
    invariant(numeric(runID), 'A numeric source or verification run ID is required');
    const source = await gh(`/actions/runs/${runID}`);
    validateWorkflow(source, repository);
    invariant(source.path.split('@')[0] === '.github/workflows/e2e-tests-ci.yml' && source.head_branch === 'master',
        'Automatic clearance executes only the reviewed PR workflow on master');
    const artifactName = `clearance-plan-${source.id}-${source.run_attempt}`;
    const artifacts = await pages(gh, `/actions/runs/${source.id}/artifacts`, 'artifacts');
    const plans = artifacts.filter(a => a.name === artifactName);
    invariant(plans.length <= 1, 'Ambiguous verification plan artifact');
    if (plans.length) {
        // Failed verification is terminal. It must not start another attempt.
        if (source.conclusion !== 'success') return {outcome: 'verification_failed', run_id: source.id};
        await finish({repository, verificationRunID: String(source.id), gh, read});
        return {outcome: 'verification_processed', run_id: source.id};
    }
    if (source.conclusion !== 'failure') return {outcome: 'no_failed_test_run', run_id: source.id};
    const n = number === undefined ? await discoverPR(source, {read, base: evidenceAPI(base)}) : prNumber(number);
    if (!n) return {outcome: 'no_pr_report', run_id: source.id};
    const marker = `<!-- mm-e2e-reverify:${source.id}:${source.run_attempt} -->`;
    const comments = await pages(gh, `/issues/${n}/comments`);
    if (comments.some(c => c.user?.login === 'github-actions[bot]' && c.user?.type === 'Bot' && c.body?.startsWith(marker))) {
        return {outcome: 'already_requested', run_id: source.id};
    }
    const planRequest = {repository, number: n, sourceRunID: String(source.id), expectedSourceAttempt: source.run_attempt, gh, read};
    const original = await plan(planRequest);
    invariant(Number(original.source_run_attempt) === source.run_attempt, 'Source run attempt changed before the request');
    const origin = new URL(evidenceAPI(base || 'https://test-io.test.mattermost.com/api/v1')).origin;
    invariant(Array.isArray(original.contexts) && original.contexts.length > 0 && original.contexts.every(c => c.origin === origin),
        'PR statuses are outside the configured Test System IO deployment');
    invariant(shaPattern.test(original.head_sha) && shaPattern.test(original.base_sha), 'Plan has no frozen PR identity');
    const snapshot = JSON.stringify(original);
    const digest = createHash('sha256').update(snapshot).digest('hex');
    const body = `${marker}\nOne automatic full-suite re-verification requested for PR #${n}.\n\n` +
        `Tested PR commit: \`${original.head_sha}\`. Compared base: \`${original.base_sha}\`.\n\n` +
        `Matching failed attempts were observed on that base. This is not proof that every PR change is harmless. ` +
        `The original statuses remain unchanged until complete fresh results satisfy the clearance policy.\n\n` +
        `Source: https://github.com/${repository}/actions/runs/${source.id}/attempts/${source.run_attempt}\n` +
        `Plan SHA-256: \`${digest}\`. No automatic retry if dispatch fails or its result is uncertain.`;
    // This workflow's fixed concurrency group serializes automated claims. Save
    // and read back the claim BEFORE dispatch: uncertain responses never cause
    // a blind second dispatch on a scheduled/event replay.
    const claim = await gh(`/issues/${n}/comments`, {body}, 'POST');
    invariant(Number.isSafeInteger(claim.id), 'Verification request was not acknowledged; do not dispatch');
    const saved = await gh(`/issues/comments/${claim.id}`);
    invariant(saved.body === body && saved.user?.login === 'github-actions[bot]' && saved.user?.type === 'Bot', 'Verification request could not be read back');
    const fresh = await plan(planRequest);
    invariant(JSON.stringify(fresh) === snapshot, 'PR evidence changed after the verification request; do not dispatch');
    try {
        await gh('/actions/workflows/e2e-tests-ci.yml/dispatches', {ref: 'master', inputs: {
            pr_number: String(n), commit_sha: original.head_sha, triage_source_run_id: String(source.id),
            triage_source_run_attempt: String(source.run_attempt),
        }}, 'POST');
    } catch (error) {
        throw Error(`Verification dispatch failed or is uncertain. The saved request prevents an automatic repeat. Inspect Actions before a maintainer retries. ${error.message}`);
    }
    return {outcome: 'verification_requested', run_id: source.id, pr_number: n};
}

main(import.meta.url, async () => {
    invariant(process.env.GITHUB_REPOSITORY === repository && process.env.GITHUB_REF === 'refs/heads/master' &&
        process.env.GITHUB_WORKFLOW_REF === `${repository}/.github/workflows/e2e-triage-shadow.yml@refs/heads/master`,
    'The automatic controller must execute the reviewed triage workflow on master');
    invariant(process.env.MM_TRIAGE_SET_STATUS === 'true', 'Automatic clearance is not enabled');
    const token = required(process.env, 'GH_TOKEN');
    const gh = (path, body, method) => request(`https://api.github.com/repos/${repository}${path}`, {token, body, method});
    const base = evidenceAPI(process.env.TSIO_URL || 'https://test-io.test.mattermost.com/api/v1');
    let runs;
    if (process.env.TRIAGE_SOURCE_RUN_ID) runs = [{id: process.env.TRIAGE_SOURCE_RUN_ID}];
    else if (process.env.PR_NUMBER) {
        const n = prNumber(process.env.PR_NUMBER);
        const pr = await gh(`/pulls/${n}`);
        invariant(pr.state === 'open' && shaPattern.test(pr.head?.sha), 'Current open PR head is required');
        const statuses = await pages(gh, `/commits/${pr.head.sha}/statuses`);
        const latest = new Map(); for (const s of statuses) if (!latest.has(s.context)) latest.set(s.context, s);
        const ids = new Set([...latest.values()].filter(s => /^e2e-test\//.test(s.context) && s.state === 'failure').map(s => {
            const url = new URL(s.target_url); invariant(apiURLs.has(url.origin + '/api/v1'), 'Untrusted status target');
            const id = url.searchParams.get('gh_run_id'); invariant(numeric(id), 'Missing E2E source run'); return id;
        }));
        invariant(ids.size === 1, 'A single current failed source run is required');
        runs = [{id: [...ids][0]}];
    } else {
        const since = new Date(Date.now() - 12 * 3600000).toISOString();
        runs = await pages(gh, `/actions/workflows/e2e-tests-ci.yml/runs?branch=master&status=completed&created=${encodeURIComponent('>=' + since)}`, 'workflow_runs');
    }
    const errors = [];
    for (const source of runs) {
        try {
            const result = await handleRun({runID: String(source.id), gh, base, ...(process.env.PR_NUMBER ? {number: process.env.PR_NUMBER} : {})});
            const text = `E2E clearance: ${result.outcome}, run ${result.run_id}.`;
            console.log(text);
            if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, text + '\n\n');
        } catch (error) { errors.push(`Run ${source.id}: ${error.message}`); }
    }
    invariant(errors.length === 0, errors.join('; '));
});
