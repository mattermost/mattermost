import {appendFile} from 'node:fs/promises';
import {clients, main, failedConclusions, workflows, validateWorkflow, sameRun, selector, invariant, recentReports, required, event} from './triage-lib.mjs';

export function statusContext(name) {
    const match = /^(playwright|cypress)-full-(enterprise|fips|team)(?:-(master|release|release-cut))?$/.exec(name);
    invariant(match, 'Unknown test suite name; configure explicit mapping before diagnosis');
    return `e2e-test/${match[1]}-full/${match[2]}${match[3] ? '/' + match[3] : ''}`;
}
export function statusMatches(status, group, run, tsioURL) {
    try {
        const url = new URL(status.target_url);
        const origin = new URL(tsioURL).origin;
        const branch = group.branch.replace(/^refs\/(heads|tags)\//, '').replaceAll('/', '~');
        const path = `/reports/${encodeURIComponent(group.repository.split('/').at(-1))}/${encodeURIComponent(branch)}/${group.commit_sha.slice(0, 7)}/${encodeURIComponent(group.name)}`;
        return status.context === statusContext(group.name) && url.origin === origin && url.pathname === path && !url.hash &&
            url.searchParams.get('gh_run_id') === String(run.id) && url.searchParams.get('gh_run_attempt') === String(run.run_attempt) && [...url.searchParams].length === 2;
    } catch { return false; }
}
export function comment(verdict, run, group, tsioURL) {
    const marker = `<!-- mm-triage:${run.id}:${run.run_attempt}:${group.name} -->`;
    const plain = value => String(value || '').replace(/[\r\n<>@`|]/g, ' ').slice(0, 250);
    const meanings = {unknown: 'Unknown: evidence is missing, incomplete, or insufficient for attribution', no_failure: 'No failed test evidence in the report; GitHub infrastructure failure is still unresolved', pr_suspect: 'PR-suspect test failure; no basis for clearance', observed_on_master: 'Failed attempts were also observed on master; causality is unresolved'};
    const root = new URL(tsioURL).origin;
    const rows = (verdict.tests || []).slice(0, 20).map(t => {
        const baseline = t.baseline_group_ids?.[0];
        return `- \`${plain(t.stable_key)}\` · \`${plain(t.file)}\`: had failed attempts in ${Number(t.baseline_failures || 0)} of ${Number(t.baseline_runs || 0)} master runs (${Number(t.baseline_failed_runs || 0)} ended failed; ${Number(t.baseline_flaky_runs || 0)} had retry-surviving failures).${baseline ? ` [Baseline report](${root}/api/v1/tests/evidence?group_id=${encodeURIComponent(baseline)})` : ''}`;
    });
    const omitted = Math.max(0, (verdict.tests?.length || 0) - rows.length);
    return `${marker}\n### E2E shadow diagnosis\n\n**${meanings[verdict.outcome] || meanings.unknown}** · suite \`${plain(group.name)}\`\n\n[Exact run and attempt](https://github.com/${group.repository}/actions/runs/${run.id}/attempts/${run.run_attempt}) · commit \`${group.commit_sha}\` · [all tests and stored verdict](${root}/api/v1/triage/verdicts/${encodeURIComponent(verdict.id)})\n\n${rows.join('\n')}${omitted ? `\n\n${omitted} additional test identities are in the stored verdict.` : ''}\n\n${verdict.reasons.slice(0, 8).map(plain).join('\n\n')}\n\nHistorical master failures do not establish that this PR is innocent. A missing test failure does not clear a failed infrastructure run. E2E remains blocking; the existing manual approval process still applies.\n`;
}
export async function diagnoseRun({run: supplied, tsio, gh, repository, reports, setStatus = false, tsioURL = process.env.TSIO_URL}) {
    invariant(!setStatus, 'MM_TRIAGE_SET_STATUS=true is unavailable during shadow-v1; automatic success is disabled');
    const live = await gh(`/actions/runs/${supplied.id}`);
    validateWorkflow(live, repository);
    invariant(String(live.id) === String(supplied.id) && live.run_attempt === supplied.run_attempt && live.head_sha === supplied.head_sha, 'Stale or mismatched GitHub run/attempt/head');
    if (!failedConclusions.has(live.conclusion)) return [];
    const groups = reports.filter(g => g.repository === repository && String(g.gh_run_id) === String(live.id) && String(g.gh_run_attempt) === String(live.run_attempt));
    const records = [];
    if (!groups.length) {
        // There may be no upload at all for startup/cancelled runs. Persist explicit unknown.
        for (const name of ['cypress-full-enterprise', 'playwright-full-enterprise']) records.push(await tsio('/triage/assessments', {repository, commit_sha: live.head_sha, gh_run_id: String(live.id), gh_run_attempt: String(live.run_attempt), name}));
        const message = `Run ${live.id}/${live.run_attempt}: no exact report groups; recorded unknown, no success status`;
        console.log(message);
        if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, `${message}\n\n`);
        return records;
    }
    for (const summary of groups) {
        const evidence = await tsio(`/tests/evidence?group_id=${encodeURIComponent(summary.id)}`); const group = evidence.group;
        invariant(group.repository === repository && String(group.gh_run_id) === String(live.id) && String(group.gh_run_attempt) === String(live.run_attempt), 'Evidence run mismatch');
        const record = await tsio('/triage/assessments', selector(group));
        invariant(record.id && sameRun(record.run, group), 'Stored assessment identity mismatch');
        const verdict = await tsio(`/triage/verdicts/${encodeURIComponent(record.id)}`);
        invariant(verdict.id === record.id && sameRun(verdict.run, group) && verdict.can_unblock === false, 'Invalid persisted shadow verdict');
        records.push(verdict);
        if (!group.gh_pr_number) continue;
        const pr = await gh(`/pulls/${group.gh_pr_number}`);
        // workflow_dispatch runs execute the trusted master workflow, while the test commit is its input.
        // Bind that input through the exact report plus the E2E commit-status target, never run.head_sha alone.
        invariant(pr.base.repo.full_name === repository && pr.state === 'open' && pr.head.sha === group.commit_sha, 'PR has changed head, closed, or belongs to another repository');
        const statuses = await gh(`/commits/${group.commit_sha}/status?per_page=100`);
        invariant(statuses.statuses.some(s => statusMatches(s, group, live, tsioURL)), 'Exact E2E status-to-run linkage missing; no PR comment');
        const freshRun = await gh(`/actions/runs/${live.id}`); const freshPR = await gh(`/pulls/${pr.number}`);
        invariant(freshRun.run_attempt === live.run_attempt && freshRun.head_sha === live.head_sha && failedConclusions.has(freshRun.conclusion) && freshPR.head.sha === group.commit_sha && freshPR.state === 'open', 'Run rerun or PR head changed during diagnosis');
        const body = comment(verdict, live, group, tsioURL); const marker = body.split('\n')[0];
        const existing = [];
        for (let page = 1; page <= 100; page++) {
            const comments = await gh(`/issues/${pr.number}/comments?per_page=100&page=${page}`);
            existing.push(...comments);
            if (comments.length < 100) break;
            invariant(page < 100, 'Comment pagination bound exceeded');
        }
        const own = existing.find(c => c.user?.type === 'Bot' && c.user?.login === 'github-actions[bot]' && c.body?.startsWith(marker));
        if (!own) await gh(`/issues/${pr.number}/comments`, {body});
        else if (own.body !== body) await gh(`/issues/comments/${own.id}`, {body}, 'PATCH');
    }
    return records;
}
export async function reconcile(gh) {
    const collected = [];
    const cutoff = new Date(Date.now() - 72 * 3600000).toISOString();
    for (const path of workflows) {
        for (let page = 1; page <= 100; page++) {
            const result = await gh(`/actions/workflows/${path.split('/').at(-1)}/runs?status=completed&created=${encodeURIComponent('>=' + cutoff)}&per_page=100&page=${page}`);
            collected.push(...result.workflow_runs.filter(r => failedConclusions.has(r.conclusion)));
            if (result.workflow_runs.length < 100) break;
            invariant(page < 100, 'Run reconciliation bound exceeded');
        }
    }
    return collected;
}
main(import.meta.url, async () => {
    const {tsio, gh} = clients(); const repository = required(process.env, 'GITHUB_REPOSITORY'); const payload = await event();
    const runs = payload.workflow_run ? [payload.workflow_run] : await reconcile(gh);
    const reports = await recentReports(tsio); const errors = [];
    for (const source of runs) {
        try { await diagnoseRun({run: source, tsio, gh, repository, reports, setStatus: process.env.MM_TRIAGE_SET_STATUS === 'true'}); }
        catch (e) { errors.push(`${source.id}/${source.run_attempt}: ${e.message}`); }
    }
    invariant(!errors.length, errors.join('; '));
});
