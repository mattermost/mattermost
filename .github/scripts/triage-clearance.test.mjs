import test from 'node:test';
import assert from 'node:assert/strict';
import {createPlan, finalize, inspectEvidence, planFromZIP} from './triage-clearance.mjs';

const repository = 'mattermost/mattermost';
const H = 'a'.repeat(40); const B = 'b'.repeat(40); const W = 'c'.repeat(40);
const origin = 'https://test-io.test.mattermost.com';
const bot = {login: 'github-actions[bot]'};
const controller = {MM_TRIAGE_SET_STATUS: 'true', GITHUB_REF: 'refs/heads/master', GITHUB_SHA: W,
    GITHUB_WORKFLOW_REF: `${repository}/.github/workflows/e2e-triage-shadow.yml@refs/heads/master`};
const contexts = ['e2e-test/cypress-full/enterprise', 'e2e-test/playwright-full/enterprise'];
const date = n => `2026-09-0${n}T00:00:00Z`;
const file = framework => framework === 'playwright' ? 'functional/example.spec.ts' : 'tests/integration/example_spec.js';
const project = framework => framework === 'playwright' ? 'chromium' : '';
function workflow(id, {master = false, success = false} = {}) {
    return {id, run_attempt: 1, head_sha: W, head_branch: 'master', repository: {full_name: repository},
        path: `.github/workflows/e2e-tests-${master ? 'on-merge' : 'ci'}.yml`, status: 'completed',
        conclusion: success ? 'success' : 'failure', event: 'workflow_dispatch', created_at: date(id === 14 ? 4 : id === 13 ? 1 : 2)};
}
function report(framework, id, {master = false, failed = false, error = 'expected error', retried = false} = {}) {
    const group = {repository, commit_sha: master ? B : H, branch: master ? 'master' : 'pr-9',
        gh_run_id: String(id), gh_run_attempt: '1', name: `${framework}-full-enterprise${master ? '-master' : ''}`,
        id: `${framework}-${id}`, framework, status: 'completed', total_reports_expected: 1, created_at: date(id === 14 ? 5 : id === 13 ? 1 : 3)};
    const environment = {worker_index: 0, server: 'onprem', server_edition: 'enterprise',
        server_image: 'mattermost/server:test', server_image_digest: `mattermost/server@sha256:${(master ? 'e' : 'd').repeat(64)}`,
        server_image_tag: 'test', server_image_repo: 'mattermost', retest_on_fail: true,
        ...(framework === 'playwright' ? {playwright_version: '1.55.0', playwright_project: 'chromium', browser_version: '141', playwright_retries: 1} : {cypress_version: '13.0.0'})};
    const count = retried ? 2 : 1; const failures = failed ? count : retried ? 1 : 0;
    const tests = Array.from({length: count}, (_, retry) => ({id: `test-${retry}`, report_id: 'worker-report', suite_id: 'suite',
        stable_key: `${framework}-stable`, file: file(framework), full_title: 'Example test', project: project(framework),
        retry_count: retry, status: failed || retried && retry === 0 ? 'failed' : 'passed',
        error_message: failed || retried && retry === 0 ? error : '', attempts: count, attempts_failed: failures, run_failed: failed}));
    const raw = {schema_version: 1, group, complete: true, truncated: false, trusted_source: true,
        source_workflow_sha: W, source_workflow_ref: `${repository}/.github/workflows/e2e-tests-${master ? 'on-merge' : 'ci'}.yml@refs/heads/master`,
        reports: [{id: 'worker-report', gh_job_id: '100', gh_job_name: 'worker', status: 'complete', environment_metadata: environment}], tests};
    const cases = framework === 'cypress' ? [{full_title: 'Example test', retry_count: count - 1,
        status: failed ? 'failed' : retried ? 'flaky' : 'passed', ...(failed || retried ? {error_message: error} : {})}] :
        tests.map(t => ({full_title: t.full_title, retry_count: t.retry_count, status: t.status, ...(t.error_message ? {error_message: t.error_message} : {})}));
    const spec = framework === 'playwright' ? `specs/${file(framework)}` : file(framework);
    const state = failed ? 'completed_fail' : 'completed_pass';
    const orchestration = {...group, ...(master ? {} : {gh_pr_number: 9}), total_units: 1,
        counts: {pending: 0, leased: 0, abandoned: 0, retest_eligible: 0, completed_fail: Number(failed), completed_pass: Number(!failed), completed_skipped: 0},
        units: [{id: 'unit', spec_path: spec, state, outcome_set_at: group.created_at, attempts: [{id: 'execution',
            spec_path: spec, gh_job_id: '100', gh_job_name: 'worker', expired: false, late_report: false,
            reported_at: group.created_at, status: failed ? 'failed' : retried ? 'flaky' : 'passed', test_cases: cases}]}]};
    return {raw: {available: true, data: raw}, orchestration: {available: true, data: orchestration}};
}
function zip(value, name = 'plan.json') {
    const data = Buffer.from(JSON.stringify(value)); const filename = Buffer.from(name);
    const local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50); local.writeUInt16LE(20, 4);
    local.writeUInt32LE(data.length, 18); local.writeUInt32LE(data.length, 22); local.writeUInt16LE(filename.length, 26);
    const entry = Buffer.concat([local, filename, data]);
    const directory = Buffer.alloc(46); directory.writeUInt32LE(0x02014b50); directory.writeUInt16LE(20, 6);
    directory.writeUInt32LE(data.length, 20); directory.writeUInt32LE(data.length, 24); directory.writeUInt16LE(filename.length, 28);
    const cd = Buffer.concat([directory, filename]); const end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50);
    end.writeUInt16LE(1, 8); end.writeUInt16LE(1, 10); end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(entry.length, 16);
    return Buffer.concat([entry, cd, end]);
}
function fixture() {
    const state = {pr: {number: 9, state: 'open', changed_files: 1, head: {sha: H, repo: {full_name: repository}},
        base: {sha: B, ref: 'master', repo: {full_name: repository}}},
    statuses: contexts.map((context, i) => ({id: 20 + i, context, state: i ? 'success' : 'failure', creator: bot,
        target_url: `${origin}/reports/mattermost/pr-9/${H.slice(0,7)}/${context.slice(9).replaceAll('/', '-')}?gh_run_id=12&gh_run_attempt=1`})),
    checks: [], files: [{filename: 'server/product.go', status: 'modified', additions: 1, deletions: 1, patch: '@@ -1 +1 @@\n-old\n+new'}],
    runs: new Map([[12, workflow(12)], [13, workflow(13, {master: true})], [14, workflow(14, {success: true})]]),
    evidence: new Map(), comments: [], writes: [], nextID: 1000, hook: null, readHook: null};
    for (const framework of ['cypress', 'playwright']) {
        for (const id of [12, 13, 14]) state.evidence.set(`${framework}-${id}`, report(framework, id, {master: id === 13, failed: framework === 'cypress' && id !== 14}));
    }
    const gh = async (path, body) => {
        await state.hook?.(path, body, state);
        if (body !== undefined) {
            state.writes.push({path, body});
            if (path === '/issues/9/comments') {const comment = {id: ++state.nextID, html_url: `https://github.com/${repository}/pull/9#issuecomment-${state.nextID}`, user: bot, body: body.body}; state.comments.push(comment); return structuredClone(comment);}
            if (path === `/statuses/${H}`) {
                const row = {...body, id: ++state.nextID, creator: bot}; state.statuses = [row, ...state.statuses.filter(s => s.context !== row.context)];
                return structuredClone(row);
            }
            assert.fail(`Unexpected write ${path}`);
        }
        if (path === '/pulls/9') return structuredClone(state.pr);
        if (path.startsWith('/pulls/9/files?')) return structuredClone(state.files);
        if (path.includes('/statuses?')) return structuredClone(state.statuses);
        if (path.includes('/check-runs?')) return {check_runs: structuredClone(state.checks)};
        if (/^\/actions\/runs\/\d+$/.test(path)) return structuredClone(state.runs.get(Number(path.split('/').at(-1))));
        if (path.startsWith('/actions/runs/14/artifacts?')) return {artifacts: [{id: 44, name: 'clearance-plan-14-1', expired: false}]};
        if (path.startsWith('/issues/9/comments?')) return structuredClone(state.comments);
        if (path.startsWith('/issues/comments/')) return structuredClone(state.comments.find(c => c.id === Number(path.split('/').at(-1))));
        assert.fail(`Unexpected read ${path}`);
    };
    const read = async value => {
        const url = new URL(value);
        if (url.pathname.endsWith('/reports')) {
            const groups = [...state.evidence.values()].map(e => e.raw.data.group).filter(g => g.gh_run_id === '13');
            return {total: groups.length, reports: groups.map(g => ({...g, commit: g.commit_sha}))};
        }
        if (url.pathname.endsWith('/tests/history')) return {runs: []};
        const framework = url.searchParams.get('name')?.split('-')[0];
        const evidence = state.evidence.get(`${framework}-${url.searchParams.get('gh_run_id')}`);
        assert.ok(evidence, `Unexpected evidence ${url}`);
        let result;
        if (url.pathname.endsWith('/triage/run-evidence')) result = structuredClone(evidence.raw.data);
        else if (url.pathname.endsWith('/orchestration/status')) result = structuredClone(evidence.orchestration.data);
        else if (url.pathname.endsWith('/tests/evidence')) result = {group: {...evidence.raw.data.group, gh_pr_number: evidence.orchestration.data.gh_pr_number}};
        else assert.fail(`Unexpected evidence ${url}`);
        return state.readHook ? state.readHook(url, result) : result;
    };
    return {state, gh, read, plan: () => createPlan({repository, number: 9, sourceRunID: '12', expectedSourceAttempt: '1', gh, read}),
        finalize: stored => finalize({repository, verificationRunID: '14', gh, read, controller, download: async () => zip(stored)})};
}
function inspect(evidence, options = {}) {
    const g = evidence.raw.data.group;
    return inspectEvidence(evidence, {selector: Object.fromEntries(['repository', 'commit_sha', 'gh_run_id', 'gh_run_attempt', 'name'].map(k => [k, g[k]])),
        run: workflow(Number(g.gh_run_id), {master: g.branch === 'master', success: g.gh_run_id === '14'}), branch: g.branch,
        ...(g.branch === 'master' ? {} : {prNumber: 9}), ...options});
}

test('real-shape Cypress base and Playwright project/path evidence are inspected', () => {
    assert.equal(inspect(report('cypress', 13, {master: true, failed: true})).failures.length, 1);
    const pw = inspect(report('playwright', 14));
    assert.match(pw.manifest[0], /functional\/example.spec.ts/);
    assert.match(pw.manifest[0], /chromium/);
});
test('complete deterministic code-PR plan pins original digest and every current context', async () => {
    const f = fixture(); const plan = await f.plan();
    assert.deepEqual(plan, await f.plan()); assert.equal(plan.head_sha, H); assert.equal(plan.base_sha, B);
    assert.equal(plan.contexts.length, 2); assert.deepEqual(plan.failed_contexts, [contexts[0]]);
    assert.equal(plan.server_images.cypress_enterprise_image, `mattermost/server@sha256:${'d'.repeat(64)}`);
    assert.equal(plan.source_run_attempt, '1'); assert.equal(f.state.writes.length, 0);
});
test('fork PR uses the same frozen-head contract', async () => {
    const f = fixture(); f.state.pr.head.repo.full_name = 'contributor/mattermost';
    assert.equal((await f.plan()).head_repository, 'contributor/mattermost');
});
test('an actual matching failed base attempt is retained even when that base test recovered', async () => {
    const f = fixture(); f.state.evidence.set('cypress-13', report('cypress', 13, {master: true, retried: true}));
    f.state.runs.get(13).conclusion = 'success';
    const plan = await f.plan(); const matched = plan.contexts[0].baseline.matched_attempts[0].base_attempts[0];
    assert.equal(matched.final_outcome, 'retry_survivor'); assert.equal(matched.retry_count, 0); assert.equal(matched.raw_row_id, 'test-0');
    await f.finalize(plan);
});
test('base matching uses the source terminal error, never a borrowed earlier error', async () => {
    const f = fixture(); const source = report('cypress', 12, {failed: true, retried: true, error: 'expected error'});
    source.raw.data.tests[1].error_message = 'new terminal error'; f.state.evidence.set('cypress-12', source);
    await assert.rejects(f.plan(), /actual failed attempt/);
});
test('known retry survivor is resolved through actual Cypress and Playwright raw chains', () => {
    for (const framework of ['cypress', 'playwright']) {
        const result = inspect(report(framework, 14, {retried: true}));
        assert.equal(result.failures.length, 0); assert.equal(result.retry_survivors.length, 1);
    }
});
test('Cypress base comparison uses terminal retry error rather than first aggregate error', () => {
    const e = report('cypress', 12, {failed: true, retried: true, error: 'first error'});
    e.raw.data.tests[1].error_message = 'final error';
    assert.equal(inspect(e).failures[0].error, 'final error');
});
test('orchestration cannot omit a terminal raw retry or duplicate an earlier one', () => {
    for (const framework of ['playwright', 'cypress']) {
        const e = report(framework, 14, {retried: true});
        const raw = e.raw.data.tests;
        raw.push({...raw[0], id: 'third', retry_count: 2});
        for (const row of raw) {row.attempts = 3; row.attempts_failed = 2; row.run_failed = false;}
        assert.throws(() => inspect(e), framework === 'playwright' ? /omitted raw/ : /summary differs/);
    }
    const duplicate = report('playwright', 14, {retried: true});
    duplicate.orchestration.data.units[0].attempts[0].test_cases.push({...duplicate.orchestration.data.units[0].attempts[0].test_cases[0]});
    assert.throws(() => inspect(duplicate), /not present/);
});
test('empty skipped specs are accepted only with a final skipped dispatch and are pinned', () => {
    const e = report('playwright', 14); const o = e.orchestration.data;
    o.total_units++; o.counts.completed_skipped++;
    o.units.push({id: 'skip', spec_path: 'specs/empty.spec.ts', state: 'completed_skipped', outcome_set_at: date(5), attempts: [{id: 'skip-attempt',
        spec_path: 'specs/empty.spec.ts', gh_job_id: '100', gh_job_name: 'worker', expired: false, late_report: false,
        status: 'skipped', reported_at: date(5), test_cases: []}]});
    assert.ok(inspect(e).skipped.includes('empty-spec:empty.spec.ts'));
    o.units[1].state = 'completed_pass'; assert.throws(() => inspect(e), /Empty dispatch/);
});
for (const [name, mutate] of [
    ['untrusted upload', e => {e.raw.data.trusted_source = false;}],
    ['incomplete upload', e => {e.raw.data.complete = false;}],
    ['truncated rows', e => {e.raw.data.truncated = true;}],
    ['missing worker', e => {e.raw.data.group.total_reports_expected = 2;}],
    ['legacy null attempts', e => {e.raw.data.tests[0].run_failed = null;}],
    ['missing retry', e => {e.raw.data.tests[0].retry_count = 1;}],
    ['wrong final timestamp', e => {e.orchestration.data.units[0].outcome_set_at = date(9);}],
    ['wrong worker', e => {e.orchestration.data.units[0].attempts[0].gh_job_id = '999';}],
    ['unresolved leased unit', e => {e.orchestration.data.counts.leased = 1;}],
    ['mutable image only', e => {e.raw.data.reports[0].environment_metadata.server_image_digest = 'mattermost/server:master';}],
    ['wrong PR', e => {e.orchestration.data.gh_pr_number = 10;}],
    ['wrong source SHA', e => {e.raw.data.source_workflow_sha = H;}],
]) test(`evidence rejects ${name}`, () => {const e = report('cypress', 12, {failed: true}); mutate(e); assert.throws(() => inspect(e));});

for (const [name, mutate] of [
    ['binary diff', s => {delete s.files[0].patch;}],
    ['missing core context', s => {s.statuses.pop();}],
    ['pending context', s => {s.statuses[1].state = 'pending';}],
    ['rolling context', s => {s.statuses[1].context = 'e2e-test/playwright-full/enterprise/upgrade-from-release-11.0';}],
    ['status from another actor', s => {s.statuses[0].creator = {login: 'someone'};}],
    ['mismatched base error', s => {s.evidence.set('cypress-13', report('cypress', 13, {master: true, failed: true, error: 'different'}));}],
    ['wrong base commit', s => {s.pr.base.sha = 'f'.repeat(40);}],
    ['source attempt advanced', s => {s.runs.get(12).run_attempt = 2;}],
    ['unknown failed check', s => {s.checks = [{id: 200, name: 'E2E other', status: 'completed', conclusion: 'failure', details_url: `https://github.com/${repository}/actions/runs/999/job/100`}];}],
]) test(`planning rejects ${name} without writes`, async () => {const f = fixture(); mutate(f.state); await assert.rejects(f.plan()); assert.equal(f.state.writes.length, 0);});

test('successful full verification writes only failed contexts after its persisted audit', async () => {
    const f = fixture(); const plan = await f.plan();
    // A pinned digest changes only the image display alias.
    for (const e of ['cypress', 'playwright'].map(framework => f.state.evidence.get(`${framework}-14`))) e.raw.data.reports[0].environment_metadata.server_image = plan.server_images.cypress_enterprise_image;
    const result = await f.finalize(plan);
    assert.deepEqual(result.statuses.map(s => s.context), [contexts[0]]);
    assert.equal(f.state.writes[0].path, '/issues/9/comments');
    assert.match(f.state.writes[0].body.body, /does not prove/);
    assert.equal(f.state.writes.filter(w => w.path.startsWith('/statuses/')).length, 1);
    const count = f.state.writes.length;
    assert.equal((await f.finalize(plan)).already_processed, true); assert.equal(f.state.writes.length, count);
});
test('a known recovered identity is allowed, while a newly flaky green-suite identity blocks', async () => {
    const allowed = fixture(); const plan = await allowed.plan(); allowed.state.evidence.set('cypress-14', report('cypress', 14, {retried: true}));
    await allowed.finalize(plan);
    const denied = fixture(); const other = await denied.plan(); denied.state.evidence.set('playwright-14', report('playwright', 14, {retried: true}));
    await assert.rejects(denied.finalize(other), /newly observed/); assert.equal(denied.state.writes.length, 0);
});
for (const [name, mutate] of [
    ['head advanced', s => {s.pr.head.sha = 'f'.repeat(40);}],
    ['base advanced', s => {s.pr.base.sha = 'f'.repeat(40);}],
    ['superseded status', s => {s.statuses[0].id++;}],
    ['verification rerun', s => {s.runs.get(14).run_attempt = 2;}],
    ['failed verification', s => {s.runs.get(14).conclusion = 'failure';}],
    ['feature workflow', s => {s.runs.get(14).head_branch = 'feature';}],
    ['changed image', s => {s.evidence.get('cypress-14').raw.data.reports[0].environment_metadata.server_image_digest = `mattermost/server@sha256:${'f'.repeat(64)}`;}],
    ['verification final failure', s => {s.evidence.set('cypress-14', report('cypress', 14, {failed: true}));}],
    ['missing verification worker', s => {s.evidence.get('playwright-14').raw.data.complete = false;}],
    ['source workflow changed', s => {s.runs.get(14).head_sha = 'f'.repeat(40); for (const framework of ['cypress', 'playwright']) s.evidence.get(`${framework}-14`).raw.data.source_workflow_sha = 'f'.repeat(40);}],
]) test(`finalization rejects ${name} before any audit/status write`, async () => {
    const f = fixture(); const plan = await f.plan(); mutate(f.state); await assert.rejects(f.finalize(plan)); assert.equal(f.state.writes.length, 0);
});
test('fabricated plan authorization flags and scope are not accepted', async () => {
    const f = fixture(); const plan = await f.plan(); plan.can_unblock = true;
    await assert.rejects(f.finalize(plan), /changed after/); assert.equal(f.state.writes.length, 0);
});
test('all contexts are checked again after the audit and before the first write', async () => {
    const f = fixture(); const plan = await f.plan();
    f.state.hook = (path, body, state) => {if (path === '/issues/9/comments' && body) state.statuses[1].id = 999;};
    await assert.rejects(f.finalize(plan), /status scope changed/);
    assert.equal(f.state.writes.filter(w => w.path.startsWith('/statuses/')).length, 0);
});
test('audit readback failure prevents any status write', async () => {
    const f = fixture(); const plan = await f.plan();
    f.state.hook = (path, body, state) => {if (path.startsWith('/issues/comments/')) state.comments[0].body = 'changed';};
    await assert.rejects(f.finalize(plan), /Stored audit/);
    assert.equal(f.state.writes.filter(w => w.path.startsWith('/statuses/')).length, 0);
});
test('audit edited after a success triggers owned rollback', async () => {
    const f = fixture(); const plan = await f.plan();
    f.state.hook = (path, body, state) => {if (path === `/statuses/${H}` && body?.state === 'success') state.comments[0].body = 'edited';};
    await assert.rejects(f.finalize(plan), /Owned statuses restored/);
});
test('only new successful checks on the exact verification run are admitted before finalization', async () => {
    for (const runID of [14, 99]) {
        const f = fixture(); const plan = await f.plan();
        f.state.checks.push({id: 50, name: 'E2E verification', status: 'completed', conclusion: 'success', details_url: `https://github.com/${repository}/actions/runs/${runID}/job/200`});
        if (runID === 14) await f.finalize(plan);
        else await assert.rejects(f.finalize(plan), /check inventory changed/);
    }
});
test('activation for staging cannot authorize production evidence', async () => {
    const f = fixture(); const plan = await f.plan();
    await assert.rejects(finalize({repository, verificationRunID: '14', gh: f.gh, read: f.read,
        download: async () => zip(plan), controller: {...controller, TSIO_URL: 'https://staging-test-io.test.mattermost.com/api/v1'}}), /activated TSIO origin/);
    assert.equal(f.state.writes.length, 0);
});
test('a verification run without a plan cannot become a new source for the old failing statuses', async () => {
    const f = fixture();
    await assert.rejects(createPlan({repository, number: 9, sourceRunID: '14', gh: f.gh, read: f.read}), /selected source run/);
    assert.equal(f.state.writes.length, 0);
});
test('post-write stale head restores an owned success', async () => {
    const f = fixture(); const plan = await f.plan();
    f.state.hook = (path, body, state) => {if (path === `/statuses/${H}` && body?.state === 'success') state.pr.head.sha = 'f'.repeat(40);};
    await assert.rejects(f.finalize(plan), /Owned statuses restored/);
    assert.equal(f.state.statuses.find(s => s.context === contexts[0]).state, 'failure');
});
test('rollback never clobbers a newer independent status', async () => {
    const f = fixture(); const plan = await f.plan(); let superseded = false;
    f.state.hook = (path, body, state) => {
        if (!body && path === '/pulls/9' && state.writes.some(w => w.path === `/statuses/${H}`) && !superseded) {
            superseded = true; state.statuses[0] = {...state.statuses[0], id: 9999, description: 'new independent failure', state: 'failure'};
        }
    };
    await assert.rejects(f.finalize(plan), /No owned status remains/);
    assert.equal(f.state.statuses[0].id, 9999);
    assert.equal(f.state.writes.filter(w => w.path.startsWith('/statuses/')).length, 1);
});
test('unacknowledged delayed status write is reported as possibly green', async () => {
    const f = fixture(); const plan = await f.plan();
    f.state.hook = (path, body) => {if (path === `/statuses/${H}` && body?.state === 'success') throw Error('POST timed out');};
    await assert.rejects(f.finalize(plan), /Status may be green/);
});
test('a new check after a status write triggers owned rollback', async () => {
    const f = fixture(); const plan = await f.plan();
    f.state.hook = (path, body, state) => {if (path === `/statuses/${H}` && body?.state === 'success') state.checks.push({id: 44, name: 'E2E new', status: 'in_progress'});};
    await assert.rejects(f.finalize(plan), /Owned statuses restored/);
});
test('an advanced base run attempt after a status write triggers owned rollback', async () => {
    const f = fixture(); const plan = await f.plan();
    f.state.hook = (path, body, state) => {if (path === `/statuses/${H}` && body?.state === 'success') state.runs.get(13).run_attempt = 2;};
    await assert.rejects(f.finalize(plan), /Owned statuses restored/);
});
test('receipt failure explicitly reports that verified statuses were already applied', async () => {
    const f = fixture(); const plan = await f.plan();
    f.state.hook = (path, body) => {if (path === '/issues/9/comments' && body?.body.startsWith('E2E verification statuses applied')) throw Error('receipt timeout');};
    await assert.rejects(f.finalize(plan), /Verified statuses were applied/);
    assert.equal(f.state.statuses.find(s => s.context === contexts[0]).state, 'success');
});
test('a stale base after the second context restores all owned successes', async () => {
    const f = fixture(); f.state.statuses[1].state = 'failure';
    f.state.evidence.set('playwright-12', report('playwright', 12, {failed: true}));
    f.state.evidence.set('playwright-13', report('playwright', 13, {master: true, failed: true}));
    const plan = await f.plan(); assert.equal(plan.failed_contexts.length, 2);
    f.state.hook = (path, body, state) => {
        if (path === `/statuses/${H}` && body?.state === 'success' && body.context === contexts[1]) state.pr.base.sha = 'f'.repeat(40);
    };
    await assert.rejects(f.finalize(plan), /Owned statuses restored/);
    assert.equal(f.state.statuses.filter(s => s.state === 'failure').length, 2);
    assert.equal(f.state.writes.filter(w => w.path.startsWith('/statuses/')).length, 4);
});
test('archive loader accepts only a bounded single plan.json data entry', () => {
    assert.deepEqual(planFromZIP(zip({test: 1})), {test: 1});
    for (const name of ['../plan.json', 'script.mjs', '/plan.json']) assert.throws(() => planFromZIP(zip({}, name)));
    assert.throws(() => planFromZIP(Buffer.alloc(5 * 1024 * 1024)));
    const wrong = zip({}); wrong.writeUInt16LE(2, wrong.length - 22 + 10); assert.throws(() => planFromZIP(wrong));
});
test('master controller activation is mandatory for final writes', async () => {
    const f = fixture();
    await assert.rejects(finalize({repository, verificationRunID: '14', gh: f.gh, controller: {...controller, MM_TRIAGE_SET_STATUS: 'false'}}), /enabled master/);
    assert.equal(f.state.writes.length, 0);
});
