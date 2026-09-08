import {mkdtemp, readFile, writeFile, lstat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {clients, main, invariant, required, shaPattern, testPath, validateWorkflow, run, artifact} from './triage-lib.mjs';
import {provider} from './triage-provider.mjs';
import {harness, verifyClean} from './triage-harness.mjs';
import {checkSource} from './triage-policy.mjs';
import {ownerFor, codeowners} from './triage-queue.mjs';

export async function disposition(diagnosis, {complete, defect, repair}) {
    if (diagnosis.decision === 'product_suspect') {
        // Terminal queue outcome FIRST. Defect endpoint never reactivates the repair path.
        await complete('product_suspect', diagnosis.account);
        return defect(diagnosis.account);
    }
    if (diagnosis.decision === 'blocked') return complete('blocked', diagnosis.account);
    invariant(diagnosis.decision === 'repair', 'Unknown diagnosis decision');
    return repair(diagnosis.account);
}
export async function publishRepair({gh, item, file, source, original, account, evidenceURL, count, fence = async () => {}, signal, onPublished = async () => {}}) {
    // One branch per logical queue item, across attempts. Uncertain API responses
    // are reconciled with GET; they never trigger a blind second PR creation.
    const branch = `codex/triage-${item.id}`;
    const head = `${item.repository.split('/')[0]}:${branch}`;
    const findPR = async () => {
        const matches = await gh(`/pulls?state=all&head=${encodeURIComponent(head)}&base=master`);
        invariant(matches.length <= 1, 'Multiple repair PRs require human reconciliation');
        return matches[0];
    };
    const currentMaster = async () => {
        const latest = await gh('/git/ref/heads/master');
        invariant(latest.object.sha === item.commit_sha, 'Master revision changed since reproduction; fresh master evidence and revalidation required');
        return latest;
    };
    const mutate = async (path, body) => { await fence(); if (path === '/pulls') await currentMaster(); return gh(path, body, 'POST', signal); };
    const latest = await currentMaster();
    const contents = await gh(`/contents/${file}?ref=${latest.object.sha}`);
    invariant(contents.type === 'file' && Buffer.from(contents.content, 'base64').toString() === original, 'Master test changed since reproduction; human rebase/revalidation required');
    let pr = await findPR();
    if (!pr) {
        let ref;
        try { ref = await gh(`/git/ref/heads/${branch}`); } catch (error) { if (error.status !== 404) throw error; }
        if (!ref) {
            const parent = await gh(`/git/commits/${item.commit_sha}`);
            const tree = await mutate('/git/trees', {base_tree: parent.tree.sha, tree: [{path: file, mode: '100644', type: 'blob', content: source}]});
            const commit = await mutate('/git/commits', {message: `fix(e2e): stabilize ${item.stable_key.replace(/[\r\n]/g, ' ').slice(0, 100)}`, tree: tree.sha, parents: [item.commit_sha]});
            try { ref = await mutate('/git/refs', {ref: `refs/heads/${branch}`, sha: commit.sha}); }
            catch (error) { ref = await gh(`/git/ref/heads/${branch}`).catch(() => null); if (!ref) { error.publicationUncertain = true; throw error; } }
        }
        const proposed = await gh(`/contents/${file}?ref=${ref.object.sha}`);
        const branchCommit = await gh(`/git/commits/${ref.object.sha}`);
        invariant(proposed.type === 'file' && Buffer.from(proposed.content, 'base64').toString() === source && branchCommit.parents.length === 1 && branchCommit.parents[0].sha === item.commit_sha, 'Existing repair branch differs from verified patch; human reconciliation required');
        const body = `#### Summary\n\n${item.owner} — human review required. No automatic merge.\n\n${account}\n\nVerified ${count} independent nonempty runs with retries disabled, preserving original test identities and assertions. Semantic safety remains a human review requirement.\n\nRecorded server: \`${item.image_digest}\`\nRecorded test commit: \`${item.commit_sha}\`\nEvidence: ${evidenceURL}\n\n#### Release Note\n\n\`\`\`release-note\nNONE\n\`\`\`\n`;
        try { pr = await mutate('/pulls', {title: `fix(e2e): stabilize ${item.stable_key.replace(/[\r\n]/g, ' ').slice(0, 100)}`, head: branch, base: 'master', body, draft: false}); }
        catch (error) { pr = await findPR().catch(() => null); if (!pr) { error.publicationUncertain = true; throw error; } }
    }
    invariant(pr.state === 'open', 'A prior repair PR is closed; human resolution required');
    const files = await gh(`/pulls/${pr.number}/files?per_page=100`);
    invariant(files.length === 1 && files[0].filename === file, 'Repair PR includes unexpected files');
    const proposed = await gh(`/contents/${file}?ref=${pr.head.sha}`);
    invariant(Buffer.from(proposed.content, 'base64').toString() === source, 'Existing repair PR differs from currently verified source');
    const publishedCommit = await gh(`/git/commits/${pr.head.sha}`);
    invariant(publishedCommit.parents.length === 1 && publishedCommit.parents[0].sha === item.commit_sha, 'Repair PR parent differs from the verified commit');
    await currentMaster();
    // Persist receipt before reviewer side effect, so review failures never requeue a second repair.
    try { await onPublished(pr); } catch (error) { error.publicationUncertain = true; throw error; }
    const owner = item.owner.replace(/^@/, '');
    await mutate(`/pulls/${pr.number}/requested_reviewers`, owner.includes('/') ? {team_reviewers: [owner.split('/')[1]]} : {reviewers: [owner]});
    return pr.html_url;
}
export async function guardian(env = process.env) {
    const {tsio, gh} = clients(env); const propose = provider(env);
    const count = Number(env.MM_TRIAGE_CLEAN_RUNS || 5);
    invariant(Number.isInteger(count) && count >= 3 && count <= 20, 'MM_TRIAGE_CLEAN_RUNS must be 3–20');
    const repository = required(env, 'GITHUB_REPOSITORY');
    invariant(/^[\w.-]+\/[\w.-]+$/.test(repository), 'Invalid repository');
    const response = await tsio('/triage/repairs/claim', {repository, worker: `github:${required(env, 'GITHUB_RUN_ID')}:${required(env, 'GITHUB_RUN_ATTEMPT')}`});
    const item = response.item;
    if (!item) { console.log('No eligible repair work'); return; }
    invariant(item.lease_token && item.repository === repository && shaPattern.test(item.commit_sha), 'Invalid claimed repair item');
    const output = resolve(required(env, 'TRIAGE_ARTIFACTS')); const abort = new AbortController();
    let terminal = false; let heartbeatError; let heartbeatPending; let publicationUncertain = false;
    const beat = async () => {
        if (terminal) return;
        if (!heartbeatPending) heartbeatPending = tsio(`/triage/repairs/${item.id}/heartbeat`, {lease_token: item.lease_token})
            .catch(error => { heartbeatError = error; abort.abort(); })
            .finally(() => { heartbeatPending = undefined; });
        await heartbeatPending;
    };
    const fence = async () => { await beat(); invariant(!heartbeatError && !abort.signal.aborted, 'Lease heartbeat failed; publication fenced'); };
    const timer = setInterval(beat, 30000);
    const evidenceURL = `https://github.com/${repository}/actions/runs/${env.GITHUB_RUN_ID}/attempts/${env.GITHUB_RUN_ATTEMPT}`;
    const complete = async (outcome, account, pr_url = '') => {
        invariant(!heartbeatError, 'Lease heartbeat failed; worker fenced');
        await tsio(`/triage/repairs/${item.id}/complete`, {lease_token: item.lease_token, outcome, account, evidence_url: evidenceURL, pr_url});
        terminal = true;
    };
    try {
        await beat(); invariant(!heartbeatError, 'Initial lease heartbeat failed');
        const sourceRun = await gh(`/actions/runs/${item.gh_run_id}/attempts/${item.gh_run_attempt}`);
        validateWorkflow(sourceRun, repository, {master: true, source: item});
        const cwd = await mkdtemp(join(tmpdir(), 'mattermost-guardian-'));
        await run('git', ['clone', '--no-checkout', '--', `https://github.com/${repository}.git`, cwd], {signal: abort.signal});
        await run('git', ['merge-base', '--is-ancestor', item.commit_sha, 'origin/master'], {cwd, signal: abort.signal});
        const file = testPath(item.framework, item.file);
        invariant(ownerFor(await codeowners(cwd, 'origin/master'), file) === item.owner, 'CODEOWNERS changed; requeue with current owner');
        await run('git', ['checkout', '--detach', item.commit_sha], {cwd, signal: abort.signal});
        const stat = await lstat(resolve(cwd, file)); invariant(stat.isFile() && !stat.isSymbolicLink(), 'Repair target must be an existing regular file');
        const original = await readFile(resolve(cwd, file), 'utf8'); invariant(original.length <= 250000, 'Test exceeds bounded repair size');
        const execution = await harness(item, cwd, output, abort.signal);
        const baseline = await execution.execute('reproduction');
        invariant(baseline.some(t => t.title === item.full_title && t.state !== 'passed'), 'Claimed failure did not reproduce; leave test unchanged');
        const evidence = {test: {framework: item.framework, file, full_title: item.full_title, stable_key: item.stable_key}, image_digest: item.image_digest, commit_sha: item.commit_sha, reproduction: baseline, source: original};
        const diagnosis = await propose.diagnose(evidence);
        await artifact(output, 'diagnosis.json', diagnosis);
        await disposition(diagnosis, {complete, defect: account => tsio(`/triage/repairs/${item.id}/defect`, {lease_token: item.lease_token, summary: `E2E caught possible product defect: ${item.stable_key}`.slice(0, 200), description: `${account}\n\nTest preserved red. Reproduction: ${evidenceURL}\nDigest: ${item.image_digest}\nCommit: ${item.commit_sha}\nOwner: ${item.owner}`}), repair: async (account) => {
            const proposal = await propose.propose({...evidence, diagnosis: account});
            invariant(proposal.source !== original, 'Provider proposed no change');
            const policy = checkSource(original, proposal.source, file, {strict: true}); await artifact(output, 'edit-policy.json', policy);
            invariant(!policy.errors.length, policy.errors.join('; '));
            await execution.apply(proposal.source);
            const diff = (await run('git', ['diff', '--no-index', '--numstat', '--', resolve(cwd, file), execution.candidate], {cwd, allowFailure: true})).stdout.trim().split(/\s+/);
            invariant(diff[0] !== '-' && Number(diff[0]) + Number(diff[1]) <= 150, 'Repair exceeds 150 changed lines');
            const verified = [];
            for (let i = 0; i < count; i++) { invariant(!heartbeatError, 'Lease heartbeat failed'); verified.push(await execution.execute(`verification-${i + 1}`)); }
            verifyClean(verified, baseline, item.full_title, count);
            invariant(!(await run('git', ['diff', '--name-only', 'HEAD'], {cwd})).stdout.trim(), 'Trusted host checkout changed during execution');
            invariant(await readFile(execution.candidate, 'utf8') === proposal.source, 'Harness altered the proposed source');
            await beat(); invariant(!heartbeatError, 'Lost lease before publishing');
            const pr = await publishRepair({gh, item, file, source: proposal.source, original, account: `${account}\n\n${proposal.account}`, evidenceURL, count, fence, signal: abort.signal, onPublished: async receipt => {
                await artifact(output, 'publication-receipt.json', {pr_url: receipt.html_url, evidence_url: evidenceURL});
                await complete('repair_pr', `${account}\n${proposal.account}`, receipt.html_url);
            }});
            await artifact(output, 'repair.json', {pr_url: pr, evidence_url: evidenceURL, clean_runs: count, image_digest: item.image_digest});

        }});
    } catch (error) {
        publicationUncertain = Boolean(error.publicationUncertain);
        await artifact(output, 'blocked.json', {reason: error.message, publication_uncertain: publicationUncertain});
        if (!terminal && !heartbeatError && !publicationUncertain) await complete('blocked', `Guardian stopped without claiming a verified repair: ${error.message}`);
        throw error;
    } finally { clearInterval(timer); }
}
main(import.meta.url, () => guardian());
