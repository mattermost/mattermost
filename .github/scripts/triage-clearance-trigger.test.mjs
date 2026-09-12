import test from 'node:test';
import assert from 'node:assert/strict';
import {discoverPR, evidenceAPI, handleRun} from './triage-clearance-trigger.mjs';

const repository = 'mattermost/mattermost';
const source = {id: 12, run_attempt: 1, repository: {full_name: repository}, path: '.github/workflows/e2e-tests-ci.yml',
    head_branch: 'master', head_sha: 'c'.repeat(40), status: 'completed', conclusion: 'failure'};
const snapshot = {schema_version: 1, repository, pr_number: 9, head_sha: 'a'.repeat(40), base_sha: 'b'.repeat(40), source_run_id: '12', source_run_attempt: 1,
    contexts: [{origin: 'https://test-io.test.mattermost.com'}]};
const bot = {login: 'github-actions[bot]', type: 'Bot'};
const marker = '<!-- mm-e2e-reverify:12:1 -->';

function fixture({run = source, artifacts = [], comments = [], errorOnDispatch, badReadback, planFailure, planChange, attemptChange} = {}) {
    const calls = []; let saved; let reads = 0; let finished = 0;
    const gh = async (path, body, method) => {
        calls.push({path, body, method});
        if (path === '/actions/runs/12') return structuredClone(run);
        if (path.startsWith('/actions/runs/12/artifacts?')) return {artifacts};
        if (path.startsWith('/issues/9/comments?')) return comments;
        if (path === '/issues/9/comments' && method === 'POST') { saved = {id: 80, body: body.body, user: bot}; return saved; }
        if (path === '/issues/comments/80') return badReadback ? {...saved, body: 'changed'} : saved;
        if (path.endsWith('/dispatches') && method === 'POST') { if (errorOnDispatch) throw Error('socket closed'); return null; }
        assert.fail(`Unexpected GitHub request ${method || 'GET'} ${path}`);
    };
    const plan = async args => {
        reads++;
        assert.equal(args.expectedSourceAttempt, 1);
        if (planFailure) throw Error(planFailure);
        return {...snapshot, ...(attemptChange ? {source_run_attempt: 2} : {}), ...(planChange && reads > 1 ? {head_sha: 'd'.repeat(40)} : {})};
    };
    return {calls, saved: () => saved, finished: () => finished,
        args: {runID: '12', gh, number: 9, plan, finish: async () => { finished++; }}};
}

test('one eligible original failure saves and reads the request before dispatching frozen head and attempt', async () => {
    const f = fixture(); const result = await handleRun(f.args);
    assert.equal(result.outcome, 'verification_requested');
    const mutations = f.calls.filter(c => c.method === 'POST');
    assert.equal(mutations.length, 2); assert.match(mutations[0].body.body, /^<!-- mm-e2e-reverify:12:1 -->/);
    assert.deepEqual(mutations[1].body, {ref: 'master', inputs: {pr_number: '9', commit_sha: snapshot.head_sha, triage_source_run_id: '12', triage_source_run_attempt: '1'}});
    assert(f.calls.findIndex(c => c.path === '/issues/comments/80') < f.calls.findIndex(c => c.path.endsWith('/dispatches')));
});

test('a persisted bot request prevents a second scheduled/event dispatch even after uncertain response', async () => {
    const f = fixture({errorOnDispatch: true});
    await assert.rejects(handleRun(f.args), /uncertain.*saved request/i);
    assert(f.saved());
    const replay = fixture({comments: [f.saved()]});
    assert.equal((await handleRun(replay.args)).outcome, 'already_requested');
    assert.equal(replay.calls.filter(c => c.method).length, 0);
});

test('a PR-authored lookalike comment cannot claim an automatic request', async () => {
    const f = fixture({comments: [{body: marker, user: {login: 'contributor', type: 'User'}}]});
    assert.equal((await handleRun(f.args)).outcome, 'verification_requested');
});

for (const [name, options, pattern] of [
    ['missing base match', {planFailure: 'base does not match'}, /base does not match/],
    ['unreadable durable claim', {badReadback: true}, /read back/],
    ['changed evidence', {planChange: true}, /evidence changed/],
    ['new original attempt during plan', {attemptChange: true}, /attempt changed/],
]) test(`${name} never dispatches`, async () => {
    const f = fixture(options); await assert.rejects(handleRun(f.args), pattern);
    assert.equal(f.calls.filter(c => c.path.endsWith('/dispatches')).length, 0);
});

test('a failed verification is terminal and cannot start a repeat-until-green loop', async () => {
    const f = fixture({artifacts: [{name: 'clearance-plan-12-1'}]});
    assert.equal((await handleRun(f.args)).outcome, 'verification_failed');
    assert.equal(f.finished(), 0); assert.equal(f.calls.filter(c => c.method).length, 0);
});

test('a successful verification delegates to the independent proof reader without re-dispatch', async () => {
    const f = fixture({run: {...source, conclusion: 'success'}, artifacts: [{name: 'clearance-plan-12-1'}]});
    assert.equal((await handleRun(f.args)).outcome, 'verification_processed');
    assert.equal(f.finished(), 1); assert.equal(f.calls.filter(c => c.method).length, 0);
});

test('source from a fork/feature workflow never reaches comment or dispatch', async () => {
    const f = fixture({run: {...source, head_branch: 'feature'}});
    await assert.rejects(handleRun(f.args), /reviewed PR workflow on master/);
    assert.equal(f.calls.length, 1);
});

test('duplicate plan artifacts are rejected rather than choosing one', async () => {
    const f = fixture({artifacts: [{name: 'clearance-plan-12-1'}, {name: 'clearance-plan-12-1'}]});
    await assert.rejects(handleRun(f.args), /Ambiguous/);
    assert.equal(f.finished(), 0);
});

test('discovery binds repository, run and attempt and rejects conflicting identities', async () => {
    const groups = [{repository: 'other/repo', gh_run_id: '12', gh_run_attempt: '1', gh_pr_number: 88},
        {repository, gh_run_id: '12', gh_run_attempt: '2', gh_pr_number: 90},
        {repository, gh_run_id: '12', gh_run_attempt: '1', branch: 'pr-9'}];
    assert.equal(await discoverPR(source, {base: 'https://test-io.test.mattermost.com/api/v1', read: async () => ({total: 3, reports: groups})}), 9);
    await assert.rejects(discoverPR(source, {base: 'https://test-io.test.mattermost.com/api/v1', read: async () => ({total: 4, reports: [...groups, {...groups[2], gh_pr_number: 77}]})}), /conflicting/);
});

test('evidence origin cannot redirect credentials or silently switch deployments', () => {
    for (const value of ['https://evil.test/api/v1', 'https://test-io.test.mattermost.com/api/v1?token=x', 'https://user@test-io.test.mattermost.com/api/v1', 'http://test-io.test.mattermost.com/api/v1']) assert.throws(() => evidenceAPI(value));
});

test('staging activation never requests clearance of production statuses', async () => {
    const f = fixture();
    await assert.rejects(handleRun({...f.args, base: 'https://staging-test-io.test.mattermost.com/api/v1'}), /outside the configured/);
    assert.equal(f.calls.filter(c => c.method).length, 0);
});
