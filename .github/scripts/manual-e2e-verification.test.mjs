import {test} from 'node:test';
import assert from 'node:assert/strict';
import {hash, verifyManually} from './manual-e2e-verification.mjs';

const head = 'a'.repeat(40);
const context = 'e2e-test/cypress-full/enterprise';
const automation = '<!-- CURSOR_AUTOMATION_ID: 90a726ff-a72f-11f1-a7d1-d6b4613131ce -->';
function fixture() {
    const scope = {context, status_id: 100, gh_run_id: '123', gh_run_attempt: '1'};
    const binding = {repository: 'mattermost/mattermost', pr_number: 38356, head_sha: head, contexts: [scope]};
    const body = `${automation}\nHistory suggests a recurring failure; no paired reproduction was available.\n<!-- TSIO_E2E_DIAGNOSIS_V1\n${JSON.stringify(binding)}\n-->`;
    const request = {repository: binding.repository, pr_number: 38356, assessed_sha: head, diagnosis_kind: 'review',
        diagnosis_id: 10, diagnosis_sha256: hash(body), contexts: [scope], reason: 'I reviewed the recurring master error and accept the documented reproduction limit.'};
    const state = {permission: 'write', mutations: [], comments: new Map(), afterApproval: () => {}, afterStatus: () => {},
        pr: {state: 'open', base: {ref: 'master'}, head: {sha: head}},
        diagnosis: {user: {login: 'cursor[bot]'}, body, commit_id: head,
            html_url: 'https://github.com/mattermost/mattermost/pull/38356#pullrequestreview-10'},
        run: {head_sha: head, status: 'completed', conclusion: 'failure', run_attempt: 1, path: '.github/workflows/e2e-tests-ci.yml'},
        statuses: [{id: 100, context, state: 'failure', creator: {login: 'github-actions[bot]'},
            target_url: `https://staging-test-io.test.mattermost.com/reports/mattermost/feature/${head.slice(0, 7)}/cypress-full-enterprise?gh_run_id=123&gh_run_attempt=1`}]};
    const io = {approver: 'maintainer', workflowSHA: 'c'.repeat(40), workflowURL: 'https://github.com/mattermost/mattermost/actions/runs/456',
        paginate: async () => structuredClone(state.statuses),
        github: async (path, payload) => {
            if (payload) state.mutations.push({path, payload});
            if (path.endsWith('/permission')) return {permission: state.permission};
            if (path.endsWith('/pulls/38356')) return state.pr;
            if (path.endsWith('/reviews/10') || path.endsWith('/issues/comments/10')) return state.diagnosis;
            if (path.includes('/actions/runs/')) return state.run;
            if (path.endsWith('/issues/38356/comments')) {
                if (state.failComment) throw Error('Comment write failed');
                const id = 20 + state.comments.size;
                state.comments.set(id, structuredClone(payload));
                state.afterApproval();
                return {id, html_url: `https://github.com/mattermost/mattermost/pull/38356#issuecomment-${id}`};
            }
            if (path.includes('/issues/comments/')) return state.comments.get(Number(path.split('/').at(-1)));
            if (path.includes('/statuses/')) {
                const status = {id: 200 + state.mutations.length, ...payload};
                state.statuses.unshift(status);
                state.afterStatus();
                return status;
            }
            throw Error(`Unexpected request ${path}`);
        }};
    return {request, state, io};
}
const writes = (state) => state.mutations.filter((mutation) => mutation.path.includes('/statuses/'));

test('records deliberate maintainer approval and raw diagnosis before exact SHA/status write and receipt', async () => {
    const {request, state, io} = fixture();
    const receipt = await verifyManually(request, io);
    assert.equal(receipt.assessed_sha, head);
    assert.equal(writes(state).length, 1);
    assert.match(state.mutations[0].payload.body, /no paired reproduction was available/);
    assert.match(state.mutations[0].payload.body, /maintainer verification approved/);
    assert.equal(writes(state)[0].path, `/repos/mattermost/mattermost/statuses/${head}`);
    assert.equal(writes(state)[0].payload.context, context);
    assert.equal(state.comments.size, 2);
});

test('supports an existing Cursor review with authoritative commit ID and explicit context/run/attempt', async () => {
    const {request, state, io} = fixture();
    state.diagnosis.body = `${automation}\n${context}: unresolved error. [Run](https://github.com/mattermost/mattermost/actions/runs/123), attempt 1.\nMaintainer judgement is needed.`;
    request.diagnosis_sha256 = hash(state.diagnosis.body);
    await verifyManually(request, io);
    assert.equal(writes(state).length, 1);
});

test('writes only the selected context even when another context newly fails', async () => {
    const {request, state, io} = fixture();
    state.afterApproval = () => state.statuses.unshift({id: 999, context: 'e2e-test/playwright-full/fips', state: 'failure'});
    await verifyManually(request, io);
    assert.deepEqual(writes(state).map((write) => write.payload.context), [context]);
});

for (const [name, change, message] of [
    ['unprivileged approver', (s) => {s.permission = 'read';}, /write or admin/],
    ['stale PR head', (s) => {s.pr.head.sha = 'b'.repeat(40);}, /head changed/],
    ['review on another SHA', (s) => {s.diagnosis.commit_id = 'b'.repeat(40);}, /another commit/],
    ['another author', (s) => {s.diagnosis.user.login = 'pr-author';}, /Cursor-authored/],
    ['another PR', (s) => {s.diagnosis.html_url = 'https://github.com/mattermost/mattermost/pull/1#pullrequestreview-10';}, /this PR/],
    ['edited diagnosis', (s) => {s.diagnosis.body += ' changed';}, /body changed/],
    ['new failure status', (s) => {s.statuses[0].id++;}, /status changed/],
    ['different run target', (s) => {s.statuses[0].target_url = s.statuses[0].target_url.replace('gh_run_id=123', 'gh_run_id=999');}, /Report target/],
    ['new workflow attempt', (s) => {s.run.run_attempt = 2;}, /attempt/],
    ['unfinished workflow', (s) => {s.run.status = 'in_progress';}, /terminal state/],
    ['failed approval write', (s) => {s.failComment = true;}, /Comment write failed/],
]) {
    test(`refuses ${name} before a status write`, async () => {
        const {request, state, io} = fixture();
        change(state);
        await assert.rejects(verifyManually(request, io), message);
        assert.equal(writes(state).length, 0);
    });
}

for (const [name, change, message] of [
    ['new head', (s) => {s.pr.head.sha = 'e'.repeat(40);}, /head changed/],
    ['edited diagnosis', (s) => {s.diagnosis.body += ' changed';}, /body changed/],
    ['rerun', (s) => {s.run.run_attempt = 2;}, /attempt/],
    ['changed status', (s) => {s.statuses[0].id++;}, /status changed/],
    ['edited stored approval', (s) => {s.comments.get(20).body += ' changed';}, /Stored approval/],
]) {
    test(`refuses ${name} after storing the approval`, async () => {
        const {request, state, io} = fixture();
        state.afterApproval = () => change(state);
        await assert.rejects(verifyManually(request, io), message);
        assert.equal(writes(state).length, 0);
    });
}

test('detects a same-SHA rerun in the write gap and restores failure', async () => {
    const {request, state, io} = fixture();
    state.afterStatus = () => {state.run.run_attempt = 2;};
    await assert.rejects(verifyManually(request, io), /restored to failure/);
    assert.equal(writes(state).length, 2);
    assert.equal(state.statuses[0].state, 'failure');
    assert.equal(state.comments.size, 1);
});

test('requires an exact structured binding for issue comments without authoritative commit_id', async () => {
    const {request, state, io} = fixture();
    request.diagnosis_kind = 'comment';
    state.diagnosis.html_url = 'https://github.com/mattermost/mattermost/pull/38356#issuecomment-10';
    await verifyManually(request, io);
    assert.equal(writes(state).length, 1);
});

test('rejects a requested context not in the diagnosis binding', async () => {
    const {request, state, io} = fixture();
    request.contexts[0].status_id = 999;
    await assert.rejects(verifyManually(request, io), /binding does not cover/);
    assert.equal(writes(state).length, 0);
});
