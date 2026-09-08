import {appendFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';

const sha = /^[a-f0-9]{40}$/;
const number = /^[1-9][0-9]*$/;
const assert = (condition, message) => { if (!condition) throw new Error(message); };

export async function resolvePR({repository, prNumber = '', commitSHA = '', github}) {
    assert(/^[\w.-]+\/[\w.-]+$/.test(repository), 'Invalid repository');
    assert(prNumber || commitSHA, 'Either pr_number or commit_sha is required');
    assert(!prNumber || number.test(prNumber), 'Invalid PR number');
    assert(!commitSHA || /^[a-f0-9]{7,40}$/.test(commitSHA), 'Invalid requested commit');
    let commit;
    if (commitSHA) {
        commit = (await github(`/commits/${commitSHA}`)).sha;
        assert(sha.test(commit) && commit.startsWith(commitSHA), 'GitHub did not resolve the requested commit');
    }
    let pr;
    if (prNumber) {
        pr = await github(`/pulls/${prNumber}`);
        assert(pr.number === Number(prNumber) && pr.state === 'open' && !pr.merged_at, 'Manual E2E requires the requested open PR');
        assert(!commit || pr.head.sha === commit, 'Requested commit is not the current PR head');
    } else {
        const matches = [];
        for (let page = 1; page <= 20; page++) {
            const rows = await github(`/commits/${commit}/pulls?per_page=100&page=${page}`);
            assert(Array.isArray(rows), 'Invalid associated PR listing');
            matches.push(...rows.filter(candidate => candidate.state === 'open' && !candidate.merged_at && candidate.head?.sha === commit && candidate.base?.repo?.full_name === repository));
            if (rows.length < 100) break;
            assert(page < 20, 'Associated PR listing exceeded its bound');
        }
        assert(matches.length <= 1, 'Multiple current PRs share this commit; dispatch with an explicit PR number');
        if (!matches.length) return {PR_NUMBER: '', COMMIT_SHA: '', BASE_SHA: '', HEAD_REF: '', reason: 'No open PR currently has this head; no status changed'};
        pr = await github(`/pulls/${matches[0].number}`);
        assert(pr.state === 'open' && !pr.merged_at && pr.head?.sha === commit, 'PR changed while resolving its test commit');
    }
    assert(pr.base?.repo?.full_name === repository && sha.test(pr.head?.sha) && sha.test(pr.base?.sha), 'Invalid PR repository/base/head identity');
    assert(typeof pr.head.ref === 'string' && pr.head.ref.length <= 1024 && !/[\r\n\0]/.test(pr.head.ref), 'Invalid PR branch identity');
    return {PR_NUMBER: String(pr.number), COMMIT_SHA: pr.head.sha, BASE_SHA: pr.base.sha, HEAD_REF: pr.head.ref, reason: 'Frozen current PR head and base; workflow checkout is a separate identity'};
}

export async function main(env = process.env) {
    const repository = env.GITHUB_REPOSITORY;
    assert(/^[\w.-]+\/[\w.-]+$/.test(repository || '') && env.GH_TOKEN, 'GitHub repository and read token are required');
    const github = async path => {
        const response = await fetch(`https://api.github.com/repos/${repository}${path}`, {
            headers: {Authorization: `Bearer ${env.GH_TOKEN}`, Accept: 'application/vnd.github+json'},
            redirect: 'error', signal: AbortSignal.timeout(30000),
        });
        assert(response.ok, `GitHub identity lookup failed (${response.status})`);
        return response.json();
    };
    const result = await resolvePR({repository, prNumber: env.INPUT_PR_NUMBER || '', commitSHA: env.INPUT_COMMIT_SHA || '', github});
    assert(env.GITHUB_OUTPUT, 'GITHUB_OUTPUT is required');
    appendFileSync(env.GITHUB_OUTPUT, ['PR_NUMBER', 'COMMIT_SHA', 'BASE_SHA', 'HEAD_REF'].map(key => `${key}=${result[key]}\n`).join(''));
    console.log(JSON.stringify(result));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch(error => {
    console.error(`Cannot resolve exact E2E target: ${error.message}`);
    process.exitCode = 1;
});
