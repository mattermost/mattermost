#!/usr/bin/env node
// Deliberate maintainer approval. This reads GitHub objects and executes no PR code.
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';

const REPOSITORY = 'mattermost/mattermost';
const CONTEXTS = new Set(['cypress', 'playwright'].flatMap((framework) =>
    ['enterprise', 'fips'].map((edition) => `e2e-test/${framework}-full/${edition}`)));
const allowedContext = context => CONTEXTS.has(context) ||
    /^e2e-test\/playwright-full\/(enterprise|fips|team)\/upgrade-from-release-[1-9][0-9]*\.(0|[1-9][0-9]*)(-esr)?$/.test(context);
const AUTOMATION = '90a726ff-a72f-11f1-a7d1-d6b4613131ce';
const check = (ok, message) => {if (!ok) throw new Error(message);};
const positive = (value) => /^[1-9][0-9]*$/.test(String(value));
export const hash = (text) => createHash('sha256').update(text).digest('hex');
const sameScope = (a, b) => ['context', 'status_id', 'gh_run_id', 'gh_run_attempt'].every((key) => a[key] === b[key]);

export async function verifyManually(request, io) {
    check(request.repository === REPOSITORY && positive(request.pr_number) && /^[a-f0-9]{40}$/.test(request.assessed_sha), 'Invalid PR/SHA identity');
    check(['maintainer', 'review', 'comment'].includes(request.diagnosis_kind), 'Invalid approval type');
    if (request.diagnosis_kind !== 'maintainer') check(positive(request.diagnosis_id) &&
        /^[a-f0-9]{64}$/.test(request.diagnosis_sha256), 'Invalid diagnosis identity/hash');
    check(typeof request.reason === 'string' && request.reason.trim().length >= 20, 'A specific maintainer approval reason is required');
    check(Array.isArray(request.contexts) && request.contexts.length > 0 && request.contexts.length <= 24 &&
        new Set(request.contexts.map((item) => item.context)).size === request.contexts.length, 'Invalid or duplicate context scope');
    for (const item of request.contexts) check(allowedContext(item.context) && Number.isSafeInteger(item.status_id) && item.status_id > 0 &&
        typeof item.gh_run_id === 'string' && positive(item.gh_run_id) && typeof item.gh_run_attempt === 'string' && positive(item.gh_run_attempt), 'Invalid context/status/run/attempt');
    check(/^[a-zA-Z0-9-]+$/.test(io.approver), 'Invalid maintainer identity');
    const repo = `/repos/${REPOSITORY}`;
    const permission = await io.github(`${repo}/collaborators/${io.approver}/permission`);
    check(['admin', 'write'].includes(permission.permission), 'The approving maintainer requires write or admin permission');
    let baseSHA;
    const inspectPR = async () => {
        const pr = await io.github(`${repo}/pulls/${request.pr_number}`);
        check(pr.state === 'open' && pr.base.ref === 'master' && pr.head.sha === request.assessed_sha, 'PR is closed, not on master, or its head changed');
        check(/^[a-f0-9]{40}$/.test(pr.base.sha), 'PR base SHA is missing');
        check(baseSHA === undefined || pr.base.sha === baseSHA, 'PR base changed after verification started');
        baseSHA ??= pr.base.sha;
    };
    const inspectDiagnosis = async () => {
        // Human authority is checked above. The exact request and reason are
        // persisted before writes; no active AI automation is needed to approve.
        if (request.diagnosis_kind === 'maintainer') return {html_url: io.workflowURL, body: request.reason};
        const path = request.diagnosis_kind === 'review' ? `${repo}/pulls/${request.pr_number}/reviews/${request.diagnosis_id}` :
            `${repo}/issues/comments/${request.diagnosis_id}`;
        const diagnosis = await io.github(path);
        const anchor = request.diagnosis_kind === 'review' ? 'pullrequestreview' : 'issuecomment';
        const url = `https://github.com/${REPOSITORY}/pull/${request.pr_number}#${anchor}-${request.diagnosis_id}`;
        check(diagnosis.html_url === url && diagnosis.user?.login === 'cursor[bot]' && typeof diagnosis.body === 'string',
            'Diagnosis is not a Cursor-authored record on this PR');
        check(hash(diagnosis.body) === request.diagnosis_sha256, 'Diagnosis body changed after maintainer review');
        check(diagnosis.body.includes(`CURSOR_AUTOMATION_ID: ${AUTOMATION}`), 'Unexpected Cursor automation identity');
        if (request.diagnosis_kind === 'review') check(diagnosis.commit_id === request.assessed_sha, 'Cursor review assessed another commit');
        const match = diagnosis.body.match(/<!-- TSIO_E2E_DIAGNOSIS_V1\s*([\s\S]*?)\s*-->/);
        if (match) {
            const binding = JSON.parse(match[1]);
            check(binding.repository === REPOSITORY && Number(binding.pr_number) === Number(request.pr_number) &&
                binding.head_sha === request.assessed_sha && Array.isArray(binding.contexts) &&
                request.contexts.every((item) => binding.contexts.some((observed) => sameScope(item, observed))),
                'Diagnosis binding does not cover the approved exact status scope');
        } else {
            // Existing Cursor reviews predate the footer. Their authoritative
            // commit_id binds the SHA; require an unambiguous single run/attempt
            // and explicit context names in the immutable reviewed body.
            check(request.diagnosis_kind === 'review', 'Issue comments require a structured diagnosis binding');
            const first = request.contexts[0];
            check(request.contexts.every((item) => item.gh_run_id === first.gh_run_id && item.gh_run_attempt === first.gh_run_attempt),
                'Legacy diagnosis cannot bind multiple run/attempt pairs');
            check(request.contexts.every((item) => diagnosis.body.includes(item.context)), 'Legacy diagnosis omits an approved context');
            const runPattern = new RegExp(`https://github\\.com/mattermost/mattermost/actions/runs/${first.gh_run_id}(?=[/?#)\\s>]|$)`);
            const attemptPattern = new RegExp(`(?:run[_ -]?)?attempt(?:\\s*[:=]\\s*|\\s+)${first.gh_run_attempt}(?![0-9])`, 'i');
            check(runPattern.test(diagnosis.body) && attemptPattern.test(diagnosis.body), 'Legacy diagnosis omits the exact workflow run or attempt');
        }
        return diagnosis;
    };
    const inspectRun = async (item) => {
        const run = await io.github(`${repo}/actions/runs/${item.gh_run_id}`);
        check(run.head_sha === request.assessed_sha && run.status === 'completed' && String(run.run_attempt) === item.gh_run_attempt &&
            ['failure', 'success'].includes(run.conclusion) && run.path === '.github/workflows/e2e-tests-ci.yml',
            'Source workflow head, attempt, path or terminal state changed');
    };
    const latest = async () => {
        const rows = await io.paginate(`${repo}/commits/${request.assessed_sha}/statuses`);
        const result = new Map();
        for (const row of rows) if (!result.has(row.context)) result.set(row.context, row);
        return result;
    };
    const inspectStatus = async (item) => {
        const status = (await latest()).get(item.context);
        check(status?.id === item.status_id && status.state === 'failure' && status.creator?.login === 'github-actions[bot]',
            'The approved GitHub Actions failure status changed');
        const url = new URL(status.target_url);
        if (url.origin === 'https://github.com') {
            check(url.pathname === `/${REPOSITORY}/actions/runs/${item.gh_run_id}` && item.gh_run_attempt === '1',
                'Status target does not bind the approved source run/attempt');
        } else {
            const name = item.context.replace(/^e2e-test\//, '').replaceAll('/', '-');
            check(['https://staging-test-io.test.mattermost.com', 'https://test-io.test.mattermost.com'].includes(url.origin) &&
                url.pathname.startsWith('/reports/mattermost/') && url.pathname.endsWith(`/${request.assessed_sha.slice(0, 7)}/${name}`) &&
                url.searchParams.get('gh_run_id') === item.gh_run_id && (url.searchParams.get('gh_run_attempt') || '1') === item.gh_run_attempt,
                'Report target does not bind the approved commit/context/run/attempt');
        }
    };
    await inspectPR();
    const diagnosis = await inspectDiagnosis();
    for (const item of request.contexts) {await inspectRun(item); await inspectStatus(item);}
    const approval = {kind: 'maintainer-e2e-verification-v1', approver: io.approver, workflow_sha: io.workflowSHA,
        workflow_run_url: io.workflowURL, base_sha: baseSHA, request, source_diagnosis_url: diagnosis.html_url, source_diagnosis_body: diagnosis.body};
    const body = `E2E: maintainer verification approved by @${io.approver}.\n\nThis is a deliberate human status waiver. Automatic diagnosis has not established the cause; raw CI outcomes remain unchanged.\n\n<details><summary>Approval and supporting reason recorded before status changes</summary>\n\n\`\`\`json\n${JSON.stringify(approval, null, 2).replaceAll('<', '\\u003c')}\n\`\`\`\n</details>`;
    check(body.length <= 60000, 'Approval exceeds GitHub comment limit');
    const comment = await io.github(`${repo}/issues/${request.pr_number}/comments`, {body});
    check(positive(comment.id) && comment.html_url === `https://github.com/${REPOSITORY}/pull/${request.pr_number}#issuecomment-${comment.id}`, 'Approval comment write was not confirmed');
    const saved = await io.github(`${repo}/issues/comments/${comment.id}`);
    check(saved.body === body, 'Stored approval differs from submitted approval');
    const description = `Maintainer verified; approval ${comment.id}`;
    const restore = async (item) => {
        const current = (await latest()).get(item.context);
        // A timed-out POST may have succeeded. Identify an unacknowledged write
        // by this unique approval; never replace a newer independent status.
        if (current?.state !== 'success' || current.target_url !== comment.html_url || current.description !== description ||
            current.creator?.login !== 'github-actions[bot]' || (item.written_id && current.id !== item.written_id)) {
            // Seeing the old failure cannot establish that a timed-out POST
            // will not arrive later. Keep this outcome explicitly uncertain.
            check(item.written_id, 'Unacknowledged status write may still complete');
            return;
        }
        const restored = await io.github(`${repo}/statuses/${request.assessed_sha}`, {state: 'failure', context: item.context,
            description: 'Verification invalidated; review approval record', target_url: comment.html_url});
        check(restored.state === 'failure' && restored.context === item.context && positive(restored.id), 'Restoration was not confirmed');
        return item.context;
    };
    const written = [];
    const attempted = [];
    try {
        for (const item of request.contexts) {
            await inspectPR();
            await inspectDiagnosis();
            await inspectRun(item);
            await inspectStatus(item);
            const attempt = {context: item.context};
            attempted.push(attempt);
            const status = await io.github(`${repo}/statuses/${request.assessed_sha}`, {state: 'success', context: item.context,
                description, target_url: comment.html_url});
            check(status.state === 'success' && status.context === item.context && positive(status.id), 'Status write was not confirmed');
            attempt.written_id = status.id;
            written.push({context: item.context, status_id: status.id});
            const current = (await latest()).get(item.context);
            check(current?.id === status.id && current.state === 'success', 'Verified status was superseded');
            await inspectPR();
            await inspectDiagnosis();
            await inspectRun(item);
        }
        // A later context must not hide a change to an earlier source run/status.
        for (const item of request.contexts) {
            await inspectRun(item);
            check((await latest()).get(item.context)?.id === written.find((row) => row.context === item.context).status_id,
                'Verified status was superseded');
        }
        await inspectPR();
    } catch (error) {
        const restored = [];
        const uncertain = [];
        for (const item of attempted) {
            try {if (await restore(item)) restored.push(item.context);} catch {uncertain.push(item.context);}
        }
        if (uncertain.length) throw Error(`Status may be green for ${uncertain.join(', ')}: restoration failed after ${error.message}; inspect ${comment.html_url}`);
        throw Error(`${restored.length ? 'Status restored to failure' : 'No owned success remains to restore'}: ${error.message}`);
    }
    const receipt = {assessed_sha: request.assessed_sha, base_sha: baseSHA, approval_url: comment.html_url, statuses: written};
    await io.github(`${repo}/issues/${request.pr_number}/comments`, {body:
        `E2E maintainer verification applied and verified on \`${request.assessed_sha}\`.\n\n[Approval and diagnosis](${comment.html_url})\n\n\`\`\`json\n${JSON.stringify(receipt, null, 2)}\n\`\`\``});
    return receipt;
}

function productionIO() {
    check(process.env.GH_TOKEN, 'Repository GITHUB_TOKEN is missing');
    async function github(path, payload) {
        const response = await fetch(`https://api.github.com${path}`, {
            method: payload ? 'POST' : 'GET', redirect: 'error', signal: AbortSignal.timeout(30000),
            headers: {Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2026-03-10',
                Authorization: `Bearer ${process.env.GH_TOKEN}`, 'Content-Type': 'application/json'},
            body: payload ? JSON.stringify(payload) : undefined,
        });
        check(response.ok, `GitHub request failed (${response.status}): ${path}`);
        return response.json();
    }
    return {github, approver: process.env.GITHUB_TRIGGERING_ACTOR || process.env.GITHUB_ACTOR,
        workflowSHA: process.env.GITHUB_SHA,
        workflowURL: `https://github.com/${REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`,
        paginate: async (path) => {
            const result = [];
            for (let page = 1; page <= 100; page++) {
                const rows = await github(`${path}?per_page=100&page=${page}`);
                check(Array.isArray(rows), 'Unexpected GitHub status list');
                result.push(...rows);
                if (rows.length < 100) return result;
            }
            throw Error('Status pagination exceeds safety bound');
        }};
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    try {
        const request = {repository: process.env.GITHUB_REPOSITORY, pr_number: process.env.PR_NUMBER,
            assessed_sha: process.env.ASSESSED_SHA, diagnosis_kind: process.env.DIAGNOSIS_KIND,
            diagnosis_id: process.env.DIAGNOSIS_ID, diagnosis_sha256: process.env.DIAGNOSIS_SHA256,
            contexts: JSON.parse(process.env.CONTEXTS_JSON || 'null'), reason: process.env.APPROVAL_REASON};
        const receipt = await verifyManually(request, productionIO());
        process.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`);
    } catch (error) {
        process.stderr.write(`Manual verification stopped: ${error.message}\n`);
        process.exitCode = 1;
    }
}
