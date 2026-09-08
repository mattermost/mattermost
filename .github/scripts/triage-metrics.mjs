import {appendFile} from 'node:fs/promises';
import {clients, invariant, main, required} from './triage-lib.mjs';
export async function observeRepairs({tsio, gh, repository}) {
    const listed = await tsio(`/triage/repairs?repository=${encodeURIComponent(repository)}&limit=200`);
    invariant(Array.isArray(listed.items), 'Invalid repair listing');
    const numbers = new Set();
    for (const item of listed.items) for (const attempt of item.attempts || []) {
        if (!attempt.pr_url) continue;
        const url = new URL(attempt.pr_url); const prefix = `/${repository}/pull/`;
        invariant(url.origin === 'https://github.com' && url.pathname.startsWith(prefix) && /^\d+$/.test(url.pathname.slice(prefix.length)), 'Invalid stored repair PR URL');
        numbers.add(url.pathname.slice(prefix.length));
    }
    const observed = {observed_at: new Date().toISOString(), listed_repairs: listed.items.length, truncated: Boolean(listed.truncated), opened_prs: 0, merged_prs: 0, open_prs: 0, closed_unmerged_prs: 0};
    for (const number of numbers) {
        const pr = await gh(`/pulls/${number}`);
        invariant(pr.base?.repo?.full_name === repository && String(pr.number) === number, 'GitHub PR identity mismatch');
        observed.opened_prs++;
        if (pr.merged) observed.merged_prs++;
        else if (pr.state === 'open') observed.open_prs++;
        else observed.closed_unmerged_prs++;
    }
    return observed;
}
main(import.meta.url, async () => {
    const observed = await observeRepairs({...clients(), repository: required(process.env, 'GITHUB_REPOSITORY')});
    const text = `Repair PR observation at ${observed.observed_at}: ${observed.opened_prs} opened, ${observed.merged_prs} merged, ${observed.open_prs} currently open, ${observed.closed_unmerged_prs} closed without merging. GitHub API checked every distinct recorded PR across ${observed.listed_repairs} listed queue items${observed.truncated ? '; list is truncated, these are observed subset counts' : ''}. No escaped-release metric is inferred.\n\n`;
    console.log(text);
    if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, text);
});
