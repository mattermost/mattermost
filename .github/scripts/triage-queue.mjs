import {clients, main, recentReports, validateWorkflow, selector, query, invariant, run, testPath} from './triage-lib.mjs';

// CODEOWNERS last-match semantics for GitHub-supported *, ** and ? patterns.
// Unsupported character classes, negation and escaped whitespace fail explicitly.
export function ownerFor(source, file) {
    let owners = [];
    for (const raw of source.split(/\r?\n/)) {
        const line = raw.replace(/\s+#.*$/, '').trim();
        if (!line || line.startsWith('#')) continue;
        const [pattern, ...next] = line.split(/\s+/);
        invariant(!/[!\[\]\\]/.test(pattern), 'Unsupported CODEOWNERS pattern; review ownership explicitly');
        let rx = pattern.replace(/[.+^${}()|]/g, '\\$&').replace(/\*\*/g, '\0').replace(/\*/g, '[^/]*').replace(/\?/g, '[^/]').replace(/\0\//g, '(?:.*/)?').replace(/\0/g, '.*');
        rx = (pattern.startsWith('/') ? '^' : pattern.includes('/') ? '^' : '(?:^|/)') + rx.replace(/^\//, '') + (pattern.endsWith('/') ? '.*' : '(?:/.*)?') + '$';
        if (new RegExp(rx).test(file)) owners = next;
    }
    invariant(owners.length && owners.every(o => /^@[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)?$/.test(o)), `No GitHub CODEOWNERS owner for ${file}`);
    return owners[0];
}
export async function codeowners(cwd, sha) {
    for (const path of ['.github/CODEOWNERS', 'CODEOWNERS', 'docs/CODEOWNERS']) {
        const r = await run('git', ['show', `${sha}:${path}`], {cwd, allowFailure: true});
        if (r.code === 0) return r.stdout;
    }
    throw new Error('Trusted revision has no CODEOWNERS');
}
export async function discover({tsio, gh, repository, cwd = process.cwd(), git = run, owners = codeowners}) {
    const candidates = (await recentReports(tsio)).filter(g => g.repository === repository && g.branch === 'master' && g.status === 'completed');
    const errors = []; const seen = new Set();
    for (const summary of candidates) {
        try {
            const evidence = await tsio(`/tests/evidence?group_id=${encodeURIComponent(summary.id)}`); const g = evidence.group;
            if (!evidence.complete || evidence.truncated || !evidence.failure_count) continue;
            invariant(g.repository === repository && g.branch === 'master' && !g.gh_pr_number, 'Not master evidence');
            const sourceRun = await gh(`/actions/runs/${g.gh_run_id}/attempts/${g.gh_run_attempt}`);
            validateWorkflow(sourceRun, repository, {master: true});
            invariant(String(sourceRun.id) === g.gh_run_id && String(sourceRun.run_attempt) === g.gh_run_attempt, 'Master run identity mismatch');
            await git('git', ['merge-base', '--is-ancestor', g.commit_sha, 'origin/master'], {cwd});
            const attribution = await tsio(`/triage/attribution?${query(selector(g))}`);
            const ownership = await owners(cwd, 'origin/master');
            for (const test of attribution.tests) {
                const key = `${g.framework}:${g.name}:${test.stable_key}`; if (seen.has(key)) continue; seen.add(key);
                const file = testPath(test.framework, test.file);
                await tsio('/triage/repairs/enqueue', {report_group_id: g.id, stable_key: test.stable_key, owner: ownerFor(ownership, file)});
            }
        } catch (error) { errors.push(`${summary.id}: ${error.message}`); }
    }
    invariant(!errors.length, errors.join('; '));
}
main(import.meta.url, async () => { const c = clients(); await discover({...c, repository: process.env.GITHUB_REPOSITORY}); });
