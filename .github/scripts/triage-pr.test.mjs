import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzePR, assessObservations, latestStatuses, observedTests, prNumber, readJSON, renderPR, statusTarget} from './triage-pr.mjs';

const repository = 'mattermost/mattermost';
const head = 'a'.repeat(40); const base = 'b'.repeat(40);
const pr = {number: 9, state: 'open', changed_files: 1, head: {sha: head, repo: {full_name: repository}}, base: {sha: base, ref: 'master', repo: {full_name: repository}}};
const files = [{filename: 'server/example.go', status: 'modified', additions: 1, deletions: 1, patch: '@@ -1 +1 @@\n-old\n+new'}];
const context = 'e2e-test/cypress-full/enterprise';
const target = `https://test-io.test.mattermost.com/reports/mattermost/pr-9/${head.slice(0, 7)}/cypress-full-enterprise?gh_run_id=12`;
const status = {id: 15, context, state: 'failure', target_url: target};
const run = {id: 12, run_attempt: 1, head_sha: 'c'.repeat(40), head_branch: 'master', repository: {full_name: repository}, path: '.github/workflows/e2e-tests-ci.yml', status: 'completed', conclusion: 'failure'};
const group = {repository, id: 'g', commit_sha: head, branch: 'pr-9', gh_pr_number: 9, gh_run_id: '12', gh_run_attempt: '1', name: 'cypress-full-enterprise', framework: 'cypress', created_at: '2026-09-09T00:00:00Z'};

function github({pull = pr, statuses = [status], workflow = run, changed = files, mutate} = {}) {
    let prReads = 0; let statusReads = 0;
    return async path => {
        if (path === '/pulls/9') return mutate?.({kind: 'pr', count: ++prReads}) || structuredClone(pull);
        if (path.startsWith('/pulls/9/files?')) return changed;
        if (path.includes('/statuses?')) return mutate?.({kind: 'statuses', count: ++statusReads}) || structuredClone(statuses);
        if (path.includes('/check-runs?')) return {check_runs: []};
        if (path === '/actions/runs/12') return structuredClone(workflow);
        assert.fail(`Unexpected GitHub operation ${path}`);
    };
}
function evidence() {
    return async url => {
        if (url.includes('/triage/run-evidence?')) return {schema_version: 1, group, complete: true, truncated: false, trusted_source: false, reports: [], tests: []};
        if (url.includes('/tests/evidence?')) return {group, complete: true, truncated: false, clusters: []};
        if (url.includes('/orchestration/status?')) return {...group, status: 'completed', units: []};
        assert.fail(`Unexpected evidence operation ${url}`);
    };
}

test('PR input is strictly numeric; shell syntax and URLs are rejected', () => {
    assert.equal(prNumber('38356'), 38356);
    for (const value of ['0', '-1', '1.1', '1; touch /tmp/x', '$(id)', 'https://github.com/a/b/pull/9', '', ' 9', '01']) assert.throws(() => prNumber(value));
});
test('latest status per context does not borrow an older failure after success', () => {
    assert.deepEqual(latestStatuses([{...status, id: 16, state: 'success'}, status, {context: 'unit', state: 'failure'}]), [{...status, id: 16, state: 'success'}]);
});
test('status targets accept supported origins and reject ambiguous or unrelated URLs', () => {
    assert.equal(statusTarget(status).attempt, null);
    for (const url of [target.replace('test-io.test.mattermost.com', 'evil.test'), target + '&gh_run_id=99', target + '&token=x', target + '#x', target.replace('=12', '=zero')]) assert.throws(() => statusTarget({...status, target_url: url}));
    assert.throws(() => statusTarget({...status, context: 'e2e-test/detox-full/enterprise'}));
});
for (const fork of [false, true]) test(`PR read supports ${fork ? 'fork' : 'same repository'} and separates workflow SHA from tested SHA`, async () => {
    const result = await analyzePR({repository, number: 9, gh: github({pull: {...pr, head: {...pr.head, repo: {full_name: fork ? 'contributor/mattermost' : repository}}}}), read: evidence()});
    assert.equal(result.fork, fork); assert.equal(result.head_sha, head); assert.equal(result.suites[0].run.head_sha, run.head_sha);
    assert.equal(result.diff.complete, true); assert.equal(result.can_unblock, false); assert.equal(result.causal_diagnosis, 'not_performed');
    assert.match(renderPR(result), /Causal diagnosis has not run/);
});
test('an omitted attempt is not guessed when the workflow was rerun', async () => {
    const result = await analyzePR({repository, number: 9, gh: github({workflow: {...run, run_attempt: 2}}), read: async () => assert.fail('must reject before fetching evidence')});
    assert.match(result.suites[0].error, /current run attempt/);
});
test('a changed PR head or base during collection invalidates the result', async () => {
    for (const field of ['head', 'base']) {
        await assert.rejects(analyzePR({repository, number: 9, gh: github({mutate: ({kind, count}) => kind === 'pr' && count === 2 ? {...pr, [field]: {...pr[field], sha: 'd'.repeat(40)}} : null}), read: evidence()}), /changed during diagnosis/);
    }
});
test('newer status on the same SHA invalidates the result', async () => {
    await assert.rejects(analyzePR({repository, number: 9, gh: github({mutate: ({kind, count}) => kind === 'statuses' && count === 2 ? [{...status, id: 99}] : null}), read: evidence()}), /statuses changed/);
});
test('green status never hides a failed workflow or incomplete upload', async () => {
    const read = evidence();
    const result = await analyzePR({repository, number: 9, gh: github({statuses: [{...status, state: 'success'}]}), read: async url => {
        const value = await read(url);
        return url.includes('/triage/run-evidence?') ? {...value, complete: false, reports: [{id: 'one'}], group: {...value.group, total_reports_expected: 2}} : value;
    }});
    assert.equal(result.suites.length, 1);
    assert.match(renderPR(result), /status is green but its linked workflow failed/);
    assert.match(renderPR(result), /Worker reports: 1\/2; all received and complete: false/);
});
test('status pagination collects E2E contexts after a full first page', async () => {
    const regular = Array.from({length: 100}, (_, id) => ({id, context: `unit-${id}`, state: 'success'}));
    const gh = github({statuses: []}); let pages = 0;
    const result = await analyzePR({repository, number: 9, gh: async path => {
        if (path.includes('/statuses?')) {pages++; return path.endsWith('page=1') ? regular : [status];}
        return gh(path);
    }, read: evidence()});
    assert.equal(pages, 4); assert.equal(result.statuses.length, 1); assert.equal(result.suites.length, 1);
});
test('full diff is not claimed for binary/missing patches or mismatched counts', async () => {
    for (const changed of [[{...files[0], patch: undefined}], [{...files[0], patch: undefined, additions:0, deletions:0}], [{...files[0], additions: 2}], []]) {
        const result = await analyzePR({repository, number: 9, gh: github({changed, statuses: []})});
        assert.equal(result.diff.complete, false); assert.equal(result.can_unblock, false);
    }
});
test('missing APIs produce an explicit limitation, never a clean diagnosis', async () => {
    const result = await analyzePR({repository, number: 9, gh: github(), read: async () => { throw Error('JSON API unavailable'); }});
    assert.equal(result.suites[0].raw.available, false); assert.equal(result.suites[0].legacy.available, false);
    assert.equal(result.can_unblock, false); assert.match(renderPR(result), /JSON API unavailable/);
});
test('same external ID in separate files/titles never shares retry observations', () => {
    const rows = [{id: 'one', report_id: 'r', suite_id: 's', file: 'a.js', full_title: 'one', project: '', stable_key: 'MM-T1', run_failed: true, status: 'failed'},
        {id: 'two', report_id: 'r', suite_id: 's', file: 'a.js', full_title: 'two', project: '', stable_key: 'MM-T1', run_failed: false, attempts_failed: 1, status: 'passed'}];
    assert.deepEqual(observedTests({tests: rows}).map(t => t.observation), ['failed_worker_execution', 'worker_retry_survivor']);
    assert.equal(observedTests({tests: [{...rows[0], run_failed: null} ]})[0].observation, 'legacy_attempts_unknown');
});
test('GitHub token is never accepted for an evidence origin and SPA HTML is rejected', async () => {
    await assert.rejects(readJSON(target, 'fixture-token', async () => assert.fail()), /GitHub API origin/);
    await assert.rejects(readJSON(target, undefined, async () => new Response('<html/>', {headers: {'content-type': 'text/html'}})), /JSON API unavailable/);
});

test('raw evidence cannot hide another PR in the orchestration or report URL', async () => {
    for (const useURL of [false, true]) {
        const normal = evidence();
        const result = await analyzePR({repository, number: 9, gh: github({statuses: [{...status, target_url: useURL ? target.replace('pr-9', 'pr-99') : target}]}), read: async url => {
            if (url.includes('/tests/evidence?')) throw Error('unavailable');
            const data = await normal(url);
            return url.includes('/orchestration/status?') ? {...data, gh_pr_number: 99} : data;
        }});
        assert.match(result.suites[0].error, /different PR/);
    }
});

const currentID = '11111111-1111-4111-8111-111111111111';
const baselineID = '22222222-2222-4222-8222-222222222222';
const file = 'tests/integration/example_spec.js';
const earlier = '2026-09-08T00:00:00Z';
function legacyRead({wrongDetail = false, baselineError = 'same error'} = {}) {
    return async value => {
        const url = new URL(value); const master = url.searchParams.get('name')?.endsWith('-master') || url.pathname.endsWith(baselineID);
        const g = {...group, id: master ? baselineID : currentID, commit_sha: master ? base : head, branch: master ? 'master' : 'pr-9',
            gh_pr_number: master ? 0 : 9, gh_run_id: master ? '13' : '12', name: group.name + (master ? '-master' : ''), created_at: master ? earlier : group.created_at};
        const at = g.created_at;
        if (url.pathname.endsWith('/reports')) return {total: 1, reports: [{...g, id: baselineID, commit: base, branch: 'master', name: group.name + '-master', gh_run_id: '13', created_at: earlier, status: 'completed'}]};
        if (/\/(triage\/run-evidence|tests\/evidence)$/.test(url.pathname)) throw Error('JSON API unavailable');
        if (url.pathname.endsWith('/orchestration/status')) return {...g, started_at: at, status: 'completed', total_units: 1,
            counts: {pending:0, leased:0, abandoned:0, retest_eligible:0, completed_pass:0, completed_fail:1, completed_skipped:0},
            units: [{id:'u', spec_path:file, state:'completed_fail', outcome_set_at:at, attempts:[{id:'a', spec_path:file, gh_job_id:'2', gh_job_name:'worker', expired:false, late_report:false, reported_at:at, status:'failed',
                test_cases:[{full_title:'exact title', status:'failed', retry_count:0, error_message:master ? baselineError : 'same error'}]}]}]};
        if (url.pathname.endsWith('/consolidated')) return {latest_commit_sha:g.commit_sha, latest_run_attempt:1, filters:{repository,commit_sha:g.commit_sha,target_name:g.name}, contributing_reports:[g.id], specs:[]};
        if (url.pathname.endsWith(g.id)) return {...g, commit:wrongDetail ? 'f'.repeat(40) : g.commit_sha, total_reports_expected:1, status:'completed', reports:[{id:'worker-report',status:'complete'}]};
        assert.fail(`Unexpected evidence URL: ${url}`);
    };
}
function githubWithMaster() {
    const normal = github();
    return path => path === '/actions/runs/13' ? {...run,id:13,path:'.github/workflows/e2e-tests-on-merge.yml'} : normal(path);
}
test('legacy production APIs provide bound workers, raw errors and a prior exact-base observation', async () => {
    const result = await analyzePR({repository, number:9, gh:githubWithMaster(), read:legacyRead()});
    const suite = result.suites[0]; assert.equal(suite.error,undefined);
    assert.deepEqual(suite.worker_reports,{received:1,expected:1,complete:true});
    assert.equal(suite.tests[0].classification,'observed_on_master');
    assert.equal(suite.tests[0].cause_proven,false); assert.equal(result.can_unblock,false);
    assert.equal(suite.baseline.relationship,'exact_pr_base');
    assert.match(renderPR(result),/trusted source: false/); assert.match(renderPR(result),/same error/);
});
test('another legacy report identity is rejected rather than counted as complete', async () => {
    const result = await analyzePR({repository,number:9,gh:github(),read:legacyRead({wrongDetail:true})});
    assert.match(result.suites[0].error,/does not match/);
});
test('same test on master with a different error does not establish a matching failure', async () => {
    const result = await analyzePR({repository,number:9,gh:githubWithMaster(),read:legacyRead({baselineError:'another error'})});
    assert.equal(result.suites[0].tests[0].classification,'unknown');
    assert.equal(result.suites[0].tests[0].baseline_same_test_and_error,false);
});
test('observations never turn changed-file overlap, unknown projects or old errors into proven causes', () => {
    const t = {file,full_title:'title',project:null,observation:'final_failure',rows:[{final_execution:true,retry_count:0,error_message:'new'},{final_execution:false,retry_count:0,error_message:'old'}]};
    const baseline = {available:true,tests:[{...t,rows:[{final_execution:true,retry_count:0,error_message:'old'}]}]};
    const result = assessObservations([t],baseline,[{filename:'e2e-tests/cypress/'+file}],'cypress')[0];
    assert.equal(result.classification,'pr_suspect'); assert.equal(result.cause_proven,false); assert.equal(result.baseline_same_test_and_error,false);
    assert.equal(assessObservations([t],{available:true,tests:[t]},[],'playwright')[0].classification,'unknown');
    assert.equal(assessObservations([{...t,observation:'retry_survivor'}],null,[],'cypress')[0].classification,'observed_flaky');
});

test('claimed trusted upload revision must match the linked GitHub workflow revision', async () => {
    const read = evidence();
    const result = await analyzePR({repository,number:9,gh:github(),read:async url => {
        const data = await read(url);
        return url.includes('/triage/run-evidence?') ? {...data,trusted_source:true,source_workflow_sha:'f'.repeat(40)} : data;
    }});
    assert.match(result.suites[0].error,/source workflow revision/);
});
test('the summary selects the final failed execution error and labels retry history', async () => {
    const result = await analyzePR({repository,number:9,gh:githubWithMaster(),read:legacyRead()});
    const test = result.suites[0].tests[0];
    test.rows.unshift({error_message:'old timeout',retry_count:0,final_execution:false});
    assert.match(renderPR(result),/Final error: same error/);
    assert.doesNotMatch(renderPR(result),/Final error: old timeout/);
    test.observation = 'retry_survivor';
    assert.match(renderPR(result),/Observed failed-attempt error: old timeout/);
});
test('a deleted head repository is unavailable, not assumed to be a fork', async () => {
    const result = await analyzePR({repository,number:9,gh:github({pull:{...pr,head:{...pr.head,repo:null}},statuses:[]})});
    assert.equal(result.fork,null); assert.match(renderPR(result),/head repository unavailable/);
});
