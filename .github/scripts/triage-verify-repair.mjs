import {mkdtemp, readFile, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {artifact, digestPattern, invariant, main, query, request, required, run, sameRun, selector, shaPattern, testPath, validateWorkflow} from './triage-lib.mjs';
import {recordedFailure, verifyReproduction} from './triage-guardian.mjs';
import {harness, verifyClean} from './triage-harness.mjs';
import {checkSource} from './triage-policy.mjs';
import {codeowners, ownerFor} from './triage-queue.mjs';

const repositoryName = 'mattermost/mattermost';
const reviewer = '@yasserfaraazkhan';
const apiURLs = new Set(['https://test-io.test.mattermost.com/api/v1', 'https://staging-test-io.test.mattermost.com/api/v1']);
const selectorKeys = ['repository', 'commit_sha', 'gh_run_id', 'gh_run_attempt', 'name', 'stable_key'];

export function parseInputs(env) {
    const repository = required(env, 'GITHUB_REPOSITORY');
    invariant(repository === repositoryName, 'Verifier is restricted to mattermost/mattermost');
    invariant(/^[1-9][0-9]*$/.test(env.REPAIR_PR_NUMBER || ''), 'A positive repair PR number is required');
    const prNumber = Number(env.REPAIR_PR_NUMBER);
    invariant(Number.isSafeInteger(prNumber), 'Invalid repair PR number');
    const raw = required(env, 'REPAIR_EVIDENCE_JSON');
    invariant(raw.length <= 10000, 'Evidence selector exceeds size limit');
    const selected = JSON.parse(raw);
    invariant(selected && !Array.isArray(selected) && JSON.stringify(Object.keys(selected).sort()) === JSON.stringify([...selectorKeys].sort()), 'Evidence JSON must contain exactly repository, commit_sha, gh_run_id, gh_run_attempt, name and stable_key');
    invariant(selectorKeys.every(k => typeof selected[k] === 'string' && selected[k].length > 0 && selected[k].length <= 4096 && !/[\0\r\n]/.test(selected[k])), 'Evidence selector fields must be nonempty strings');
    invariant(selected.repository === repository && shaPattern.test(selected.commit_sha) && /^[1-9][0-9]*$/.test(selected.gh_run_id) && /^[1-9][0-9]*$/.test(selected.gh_run_attempt), 'Invalid exact master evidence selector');
    invariant(/^(playwright|cypress)-full-(enterprise|fips)-master$/.test(selected.name), 'Only full master suites can verify repairs');
    return {repository, prNumber, selected};
}

// This verifier has no TSIO authentication and exposes only GET operations.
export function readClients(env, fetcher = fetch) {
    const base = env.TSIO_URL || 'https://test-io.test.mattermost.com/api/v1';
    invariant(apiURLs.has(base), 'TSIO_URL must be the explicit production or staging /api/v1 URL');
    invariant(env.GITHUB_REPOSITORY === repositoryName, 'Untrusted repository');
    const token = required(env, 'GH_TOKEN');
    return {
        tsio: path => request(`${base}${path}`, {method: 'GET', fetcher}),
        gh: path => request(`https://api.github.com/repos/${repositoryName}${path}`, {token, method: 'GET', fetcher}),
    };
}

function canonical(value) {
    if (Array.isArray(value)) return value.map(canonical);
    if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(k => [k, canonical(value[k])]));
    return value;
}
function environment(metadata) {
    invariant(metadata && typeof metadata === 'object' && !Array.isArray(metadata), 'Missing immutable registration environment');
    const digests = [metadata.image_digest, metadata.server_image_digest].filter(v => v !== undefined);
    invariant(digests.length && digests.every(v => typeof v === 'string' && digestPattern.test(v) && v === digests[0]), 'Recorded image digest aliases are missing or disagree');
    const normalized = {...metadata, image_digest: digests[0]};
    delete normalized.server_image_digest; delete normalized.worker_index; delete normalized.project;
    return canonical(normalized);
}
export function deriveItem(selected, evidence, prNumber) {
    invariant(evidence?.group && sameRun(evidence.group, selected), 'Raw evidence differs from the exact selected run');
    invariant(Array.isArray(evidence.tests) && Array.isArray(evidence.reports), 'Raw evidence rows are missing');
    const rows = evidence.tests.filter(t => t.stable_key === selected.stable_key);
    invariant(rows.length > 0, 'Selected test is absent from the raw evidence');
    const first = rows[0];
    invariant(typeof first.full_title === 'string' && first.full_title && (first.project == null || typeof first.project === 'string'), 'Recorded test identity is missing');
    const metadata = rows.map(row => environment(evidence.reports.find(r => r.id === row.report_id)?.environment_metadata));
    invariant(metadata.every(value => JSON.stringify(value) === JSON.stringify(metadata[0])), 'Target reports disagree on immutable harness environment');
    const framework = evidence.group.framework;
    invariant(selected.name.startsWith(`${framework}-`), 'Recorded framework differs from suite identity');
    const item = {...selected, id: `verify-pr-${prNumber}`, report_group_id: evidence.group.id, source_workflow_sha: evidence.source_workflow_sha,
        framework, file: testPath(framework, first.file), full_title: first.full_title, project: first.project ?? '',
        image_digest: metadata[0].image_digest, environment_metadata: metadata[0], owner: reviewer};
    recordedFailure(item, evidence);
    return item;
}

function validatePR(pr, number) {
    invariant(pr?.number === number && pr.state === 'open' && pr.base?.repo?.full_name === repositoryName && pr.base.ref === 'master' && shaPattern.test(pr.head?.sha), 'Repair must be an open PR against mattermost/mattermost master');
    invariant(pr.changed_files === 1, 'Repair PR must change exactly one existing test file');
}
function validateFiles(files, file) {
    invariant(Array.isArray(files) && files.length === 1 && files[0].filename === file && files[0].status === 'modified' && !files[0].previous_filename, 'Repair PR includes unexpected, added, renamed or deleted files');
}
async function git(cwd, ...args) { return (await run('git', args, {cwd})).stdout.trim(); }
async function readSource(cwd, sha, file) {
    const entry = await git(cwd, 'ls-tree', '-z', sha, '--', file);
    invariant(entry.startsWith('100644 blob ') && entry.endsWith(`\t${file}\0`) && entry.split('\0').length === 2, 'Repair target must be an existing regular test file');
    return (await run('git', ['show', `${sha}:${file}`], {cwd, maxBytes: 250000})).stdout;
}
export async function refreshCheckout(cwd, prNumber) {
    await run('git', ['fetch', '--no-tags', 'origin', '+refs/heads/master:refs/remotes/origin/master', `+refs/pull/${prNumber}/head:refs/remotes/origin/triage-repair-head`], {cwd});
}
async function checkoutTrusted(repository, prNumber) {
    invariant(repository === repositoryName, 'Untrusted clone repository');
    const cwd = await mkdtemp(join(tmpdir(), 'mattermost-verify-repair-'));
    await run('git', ['clone', '--no-checkout', '--', `https://github.com/${repository}.git`, cwd]);
    await refreshCheckout(cwd, prNumber);
    return cwd;
}
export async function inspectCandidate(cwd, pr, item) {
    validatePR(pr, Number(item.id.replace('verify-pr-', '')));
    const master = await git(cwd, 'rev-parse', 'refs/remotes/origin/master');
    invariant(await git(cwd, 'rev-parse', 'refs/remotes/origin/triage-repair-head') === pr.head.sha, 'Fetched repair PR head changed');
    await run('git', ['merge-base', '--is-ancestor', item.commit_sha, master], {cwd});
    const mergeBase = await git(cwd, 'merge-base', master, pr.head.sha);
    invariant(shaPattern.test(mergeBase), 'Repair PR has no unique trusted merge base');
    const changes = await git(cwd, 'diff', '--no-renames', '--name-status', '-z', mergeBase, pr.head.sha, '--');
    invariant(changes === `M\0${item.file}\0`, 'Actual repair diff must modify only the selected existing test file');
    const original = await readSource(cwd, item.commit_sha, item.file);
    invariant(await readSource(cwd, master, item.file) === original, 'Master test changed or was deleted since recorded failure; fresh evidence is required');
    invariant(await readSource(cwd, mergeBase, item.file) === original, 'Repair PR base test differs from recorded original source');
    invariant(ownerFor(await codeowners(cwd, master), item.file) === reviewer, 'Current trusted CODEOWNERS must name @yasserfaraazkhan for this test');
    const source = await readSource(cwd, pr.head.sha, item.file);
    invariant(source !== original, 'Repair PR has no candidate test change');
    const stat = await git(cwd, 'diff', '--no-renames', '--numstat', '-z', item.commit_sha, pr.head.sha, '--', item.file);
    const counts = stat.match(/^(\d+)\t(\d+)\t/);
    invariant(counts && Number(counts[1]) + Number(counts[2]) <= 150, 'Repair exceeds 150 changed lines or is binary');
    return {master, mergeBase, original, source};
}

export async function verifyRepair({repository, prNumber, selected, output, controllerSHA, gh, tsio, checkout = checkoutTrusted, refresh = refreshCheckout, createHarness = harness}) {
    try {
        invariant(repository === repositoryName && selected.repository === repository && shaPattern.test(controllerSHA), 'Trusted controller repository/revision is required');
        await artifact(output, 'request.json', {pr_number: prNumber, selector: selected, controller_sha: controllerSHA, reviewer});
        const [pr, evidence] = await Promise.all([gh(`/pulls/${prNumber}`), tsio(`/triage/run-evidence?${query(selector(selected))}`)]);
        validatePR(pr, prNumber);
        const item = deriveItem(selected, evidence, prNumber);
        const recorded = recordedFailure(item, evidence);
        const sourceRun = await gh(`/actions/runs/${item.gh_run_id}/attempts/${item.gh_run_attempt}`);
        validateWorkflow(sourceRun, repository, {master: true, source: item});
        validateFiles(await gh(`/pulls/${prNumber}/files?per_page=100`), item.file);
        await artifact(output, 'recorded-failure.json', {item, expected: recorded, source_workflow: sourceRun,
            evidence: {...evidence, tests: evidence.tests.filter(t => t.stable_key === item.stable_key), reports: evidence.reports.filter(r => evidence.tests.some(t => t.stable_key === item.stable_key && t.report_id === r.id))}});
        const cwd = await checkout(repository, prNumber);
        const initial = await inspectCandidate(cwd, pr, item);
        const policy = checkSource(initial.original, initial.source, item.file, {strict: true});
        await artifact(output, 'edit-policy.json', policy);
        invariant(!policy.errors.length, policy.errors.join('; '));
        const diff = (await run('git', ['diff', '--no-ext-diff', '--no-textconv', item.commit_sha, pr.head.sha, '--', item.file], {cwd})).stdout;
        await writeFile(join(output, 'candidate.diff'), diff);

        // Only the immutable trusted master ancestor is ever checked out. The
        // PR's one test file is overlaid inside the existing Docker sandbox.
        await run('git', ['checkout', '--detach', item.commit_sha], {cwd});
        const execution = await createHarness(item, cwd, output);
        invariant(await readFile(join(cwd, item.file), 'utf8') === initial.original &&
            await readFile(execution.candidate, 'utf8') === initial.original,
        'Harness setup changed the recorded original test source before reproduction');
        const baseline = await execution.execute('reproduction');
        await artifact(output, 'reproduction-tests.json', baseline);
        verifyReproduction(baseline, recorded);
        await execution.apply(initial.source);
        const verified = [];
        for (let i = 0; i < 5; i++) {
            const tests = await execution.execute(`verification-${i + 1}`);
            await artifact(output, `verification-${i + 1}-tests.json`, tests);
            verified.push(tests);
        }
        verifyClean(verified, baseline, item.full_title, 5);
        invariant(!(await git(cwd, 'diff', '--name-only', 'HEAD')), 'Trusted host checkout changed during execution');
        invariant(await readFile(execution.candidate, 'utf8') === initial.source, 'Harness altered the candidate source');

        await refresh(cwd, prNumber);
        const currentPR = await gh(`/pulls/${prNumber}`);
        validatePR(currentPR, prNumber);
        invariant(currentPR.head.sha === pr.head.sha, 'Repair PR head changed during verification; verify its new revision');
        validateFiles(await gh(`/pulls/${prNumber}/files?per_page=100`), item.file);
        const final = await inspectCandidate(cwd, currentPR, item);
        invariant(final.source === initial.source, 'Candidate source changed during verification');
        const result = {outcome: 'verified', repository, pr_number: prNumber, pr_head_sha: pr.head.sha,
            tested_base_sha: item.commit_sha, source_workflow_sha: item.source_workflow_sha, controller_sha: controllerSHA,
            initial_master_sha: initial.master, current_master_sha: final.master, pr_merge_base_sha: final.mergeBase,
            selector: selected, file: item.file, project: item.project, full_title: item.full_title,
            image_digest: item.image_digest, clean_runs: 5, retries: 0, reviewer, automatic_merge: false,
            limitations: 'Only the candidate test file was verified on the recorded master ancestor. Current-head product compatibility and semantic correctness require normal PR CI and human review.',
            policy_annotations: policy.annotations};
        await artifact(output, 'verification.json', result);
        return result;
    } catch (error) {
        await artifact(output, 'blocked.json', {outcome: 'blocked', reason: error.message, pr_number: prNumber, selector: selected});
        throw error;
    }
}

main(import.meta.url, async () => {
    invariant(process.env.GITHUB_REF === 'refs/heads/master' && process.env.GITHUB_EVENT_NAME === 'workflow_dispatch', 'Run the trusted master workflow by manual dispatch');
    const inputs = parseInputs(process.env);
    const result = await verifyRepair({...inputs, ...readClients(process.env), output: resolve(required(process.env, 'TRIAGE_ARTIFACTS')), controllerSHA: required(process.env, 'GITHUB_SHA')});
    if (process.env.GITHUB_STEP_SUMMARY) await writeFile(process.env.GITHUB_STEP_SUMMARY,
        `Verified five retry-free candidate runs for [PR #${result.pr_number}](https://github.com/${result.repository}/pull/${result.pr_number}) at \`${result.pr_head_sha}\`.\n\nTested base: \`${result.tested_base_sha}\`. Latest master observed: \`${result.current_master_sha}\`.\n\n${reviewer}: review the attached evidence and normal PR CI before merging. ${result.limitations}\n`);
});
