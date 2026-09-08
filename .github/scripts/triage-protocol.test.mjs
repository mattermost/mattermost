import test from 'node:test';
import assert from 'node:assert/strict';
import {failedConclusions, testPath, harnessEnv, digestPattern, validateWorkflow} from './triage-lib.mjs';
import {checkSource} from './triage-policy.mjs';
import {ownerFor} from './triage-queue.mjs';
import {disposition, publishRepair} from './triage-guardian.mjs';
import {diagnoseRun, statusMatches, reconcile} from './triage-diagnose.mjs';
import {reportTests, mergeAttempts, verifyClean} from './triage-harness.mjs';
import {provider} from './triage-provider.mjs';

const source = `import {test, expect} from '@playwright/test';\ntest('keeps behavior', async ({page}) => { await page.click('#save'); await expect(page.locator('#saved')).toBeVisible(); });`;
const check = (after, strict = false) => checkSource(source, after, 'case.spec.ts', {strict});
for (const [label, replacement] of [
    ['skip', 'test.skip'], ['only', 'test.only'], ['fixme', 'test.fixme'],
    ['computed skip', "test['skip']"], ['optional skip', 'test?.skip'],
]) test(`policy blocks ${label}`, () => assert.ok(check(source.replace("test('keeps", `${replacement}('keeps`)).errors.length));
for (const [label, addition] of [
    ['alias skip', 'const omit = test.skip; omit(true);'],
    ['destructured skip', 'const {skip: omit} = test; omit(true);'],
    ['bare Cypress wait', 'cy.wait(1000);'], ['nonliteral wait', 'cy.wait(delay);'],
    ['Playwright sleep', 'await page.waitForTimeout(50);'], ['timer', 'setTimeout(done, 5);'],
    ['ignore tag', '// @ignore\n'], ['skip tag', '// @skip\n'],
]) test(`policy blocks ${label}`, () => assert.ok(check(source + '\n' + addition).errors.length));
test('policy allows event-based waits and comments mentioning .skip()', () => assert.equal(check(source + "\ncy.wait('@save'); // test.skip() is prohibited\n").errors.length, 0));
test('assertion deletion blocked', () => assert.ok(check(source.replace("await expect(page.locator('#saved')).toBeVisible();", '')).errors.length));
test('moving assertion to a different test does not preserve coverage', () => {
    const moved = source.replace("await expect(page.locator('#saved')).toBeVisible();", '') + "\ntest('new', async () => { await expect(page.locator('#saved')).toBeVisible(); });";
    assert.ok(check(moved).errors.length);
});
test('human matcher change annotated; Guardian refuses it', () => {
    const edit = source.replace('.toBeVisible()', '.toBeTruthy()');
    assert.equal(check(edit).errors.length, 0); assert.ok(check(edit).annotations.length); assert.ok(check(edit, true).errors.length);
});
test('literal timeout decrease allowed, increase blocked, expression annotated', () => {
    const old = 'const config = {timeout: 100};';
    assert.equal(checkSource(old, 'const config = {timeout: 50};', 'config.ts').errors.length, 0);
    assert.ok(checkSource(old, 'const config = {timeout: 200};', 'config.ts').errors.length);
    assert.ok(checkSource(old, 'const config = {timeout: limit};', 'config.ts').annotations.length);
});
test('Guardian preserves string whitespace inside assertions', () => {
    assert.ok(checkSource("expect(x).toBe('foo bar');", "expect(x).toBe('foobar');", 'case.ts', {strict: true}).errors.length);
});
test('only claimed regular test paths accepted', () => {
    assert.equal(testPath('playwright', 'specs/channel.spec.ts'), 'e2e-tests/playwright/specs/channel.spec.ts');
    assert.equal(testPath('playwright', 'channels/channel.spec.ts'), 'e2e-tests/playwright/specs/channels/channel.spec.ts');
    for (const path of ['../server/app.go', '/etc/passwd', 'specs/../../config.ts', 'playwright.config.ts']) assert.throws(() => testPath('playwright', path));
    assert.throws(() => testPath('detox', 'test.js'));
});
test('only immutable pullable image references accepted', () => {
    assert.ok(digestPattern.test('registry.example/mm/server@sha256:' + 'a'.repeat(64)));
    for (const image of ['mattermost/server:master', 'sha256:' + 'a'.repeat(64), 'mm@sha256:short']) assert.ok(!digestPattern.test(image));
});
test('harness strips all orchestration/provider/workflow credentials', () => {
    assert.deepEqual(harnessEnv({PATH: '/bin', GH_TOKEN: 'secret', OPENAI_API_KEY: 'secret', TSIO_TRIAGE_API_KEY: 'secret', ACTIONS_ID_TOKEN_REQUEST_URL: 'secret', GITHUB_TOKEN: 'secret', MM_LICENSE: 'license'}), {PATH: '/bin', MM_LICENSE: 'license'});
});
test('CODEOWNERS uses last matching rule and refuses missing ownership', () => {
    const owners = '* @default\n/e2e-tests/ @qa\n/e2e-tests/playwright/** @pw\n/e2e-tests/playwright/specs/private/\n';
    assert.equal(ownerFor(owners, 'e2e-tests/playwright/specs/a.spec.ts'), '@pw');
    assert.throws(() => ownerFor(owners, 'e2e-tests/playwright/specs/private/a.spec.ts'));
    assert.throws(() => ownerFor('/server/ @server', 'e2e-tests/x'));
});
test('product suspect durably completes before defect; never invokes repair', async () => {
    const calls = [];
    await disposition({decision: 'product_suspect', account: 'Evidence of product behavior'}, {complete: async o => calls.push(o), defect: async () => calls.push('defect'), repair: async () => assert.fail('test edit called')});
    assert.deepEqual(calls, ['product_suspect', 'defect']);
});
test('terminal completion failure prevents Jira submission', async () => {
    await assert.rejects(disposition({decision: 'product_suspect', account: 'evidence'}, {complete: async () => {throw Error('lost lease');}, defect: async () => assert.fail(), repair: async () => assert.fail()}), /lost lease/);
});
const pw = (state = 'passed', retry = 0, results = 1) => ({suites: [{title: 'a.spec.ts', specs: [{title: 'does thing', tests: [{projectName: 'chrome', results: Array.from({length: results}, () => ({status: state, retry}))}]}]}]});
test('Playwright parser requires nonempty, retry-free, non-skipped results', () => {
    assert.equal(reportTests('playwright', pw(), 'chrome')[0].title, 'a.spec.ts > does thing');
    for (const report of [{suites: []}, pw('skipped'), pw('passed', 1), pw('passed', 0, 2), {...pw(), errors: [{message: 'infra'}]}]) assert.throws(() => reportTests('playwright', report, 'chrome'));
});
test('Cypress requires actual after:spec attempt sidecar joined by full title', () => {
    const report = {results: [{suites: [{tests: [{fullTitle: 'suite does thing', state: 'passed'}]}]}]};
    assert.throws(() => reportTests('cypress', report, ''));
    mergeAttempts(report, {tests: [{title: ['suite', 'does thing'], attempts: [{state: 'passed'}]}]});
    assert.equal(reportTests('cypress', report, '')[0].attempts, 1);
    assert.throws(() => mergeAttempts(report, {tests: []}));
});
test('N verification preserves every original test identity and requires every pass', () => {
    const pass = reportTests('playwright', pw(), 'chrome'); const fail = reportTests('playwright', pw('failed'), 'chrome');
    verifyClean([pass, pass, pass], fail, fail[0].title, 3);
    for (const runs of [[pass, pass], [pass, pass, []], [pass, pass, fail]]) assert.throws(() => verifyClean(runs, fail, fail[0].title, 3));
    assert.throws(() => verifyClean([pass, pass, pass], fail, 'other test', 3));
});
const repository = 'mattermost/mattermost'; const sha = 'a'.repeat(40);
const workflow = {id: 12, repository: {full_name: repository}, path: '.github/workflows/e2e-tests-ci.yml', head_sha: sha, head_branch: 'master', status: 'completed', conclusion: 'failure', run_attempt: 2};
const group = {id: 'g', repository, commit_sha: sha, gh_run_id: '12', gh_run_attempt: '2', name: 'playwright-full-enterprise', branch: 'pr-9', gh_pr_number: 9};
const target = `https://tsio.example/reports/mattermost/pr-9/${sha.slice(0, 7)}/playwright-full-enterprise?gh_run_id=12&gh_run_attempt=2`;
const status = {context: 'e2e-test/playwright-full/enterprise', target_url: target};
test('status linkage binds trusted TSIO origin and exact run attempt', () => {
    assert.ok(statusMatches(status, group, workflow, 'https://tsio.example/api/v1'));
    for (const bad of [target.replace('tsio.example', 'evil.example'), target.replace('attempt=2', 'attempt=1'), target.replace('id=12', 'id=13'), target + '&gh_run_id=13']) assert.ok(!statusMatches({...status, target_url: bad}, group, workflow, 'https://tsio.example/api/v1'));
});
for (const conclusion of failedConclusions) test(`${conclusion} with no report records unknown and never writes GitHub status`, async () => {
    let stored = 0;
    await diagnoseRun({run: {...workflow, conclusion}, repository, reports: [], gh: async (path, body) => { assert.equal(path, '/actions/runs/12'); assert.equal(body, undefined); return {...workflow, conclusion}; }, tsio: async (path) => {assert.equal(path, '/triage/assessments'); stored++; return {outcome: 'unknown', can_unblock: false};}});
    assert.equal(stored, 2);
});
test('shadow flag cannot be enabled, stale run attempt/head rejected', async () => {
    const args = {run: workflow, repository, reports: [], tsio: async () => assert.fail(), gh: async () => ({...workflow, run_attempt: 3})};
    await assert.rejects(diagnoseRun({...args, setStatus: true}), /disabled/);
    await assert.rejects(diagnoseRun(args), /Stale/);
    await assert.rejects(diagnoseRun({...args, gh: async () => ({...workflow, head_sha: 'b'.repeat(40)})}), /Stale/);
});
test('stored verdict readback precedes exact-head PR comment and no status mutation', async () => {
    const calls = []; const verdict = {id: 'v1', run: group, outcome: 'observed_on_master', can_unblock: false, tests: [{}], reasons: ['Master observations alone cannot authorize clearance']};
    const gh = async (path, body) => {
        calls.push(path);
        if (path === '/actions/runs/12') return workflow;
        if (path === '/pulls/9') return {number: 9, state: 'open', base: {repo: {full_name: repository}}, head: {sha}};
        if (path.includes('/status?')) return {statuses: [status]};
        if (path.includes('/comments?')) return [];
        if (path === '/issues/9/comments') {assert.match(body.body, /remains blocking/); return {};}
        assert.fail(path);
    };
    const tsio = async path => {calls.push(path); return path.includes('evidence') ? {group} : verdict;};
    await diagnoseRun({run: workflow, repository, reports: [group], gh, tsio, tsioURL: 'https://tsio.example/api/v1'});
    assert.ok(calls.indexOf('/triage/verdicts/v1') < calls.indexOf('/issues/9/comments'));
});
test('reconciliation includes all four failed conclusions across allowed workflows', async () => {
    let calls = 0; const runs = await reconcile(async path => {assert.match(path, /status=completed/); calls++; return {workflow_runs: [...failedConclusions].map(conclusion => ({conclusion})).concat({conclusion: 'success'})};});
    assert.equal(calls, 3); assert.equal(runs.length, 12);
});
test('untrusted master workflow rejected', () => { assert.throws(() => validateWorkflow(workflow, repository, {master: true})); });
test('configured live provider sends bounded tool-free structured request', async () => {
    let calls = 0;
    const p = provider({MM_TRIAGE_PROVIDER: 'openai', OPENAI_API_KEY: 'test', MM_TRIAGE_MODEL: 'configured-model'}, async (url, options) => {
        assert.equal(String(url), 'https://api.openai.com/v1/responses'); const body = JSON.parse(options.body);
        assert.equal(body.store, false); assert.equal(body.tools, undefined); assert.equal(body.text.format.strict, true); calls++;
        return {ok: true, status: 200, json: async () => ({status: 'completed', output: [{content: [{type: 'output_text', text: JSON.stringify({decision: 'product_suspect', account: 'The unchanged assertion caught incorrect product behavior.'})}]}]})};
    });
    assert.equal((await p.diagnose({source})).decision, 'product_suspect'); assert.equal(calls, 1);
    assert.throws(() => provider({MM_TRIAGE_PROVIDER: 'openai', MM_TRIAGE_MODEL: 'x'}), /OPENAI_API_KEY/);
    assert.throws(() => provider({MM_TRIAGE_PROVIDER: 'unsupported'}), /Supported/);
});

test('candidate sandbox has no host PID/socket or secret authority and all source mounts are read-only', async () => {
    const {sandboxArgs} = await import('./triage-harness.mjs');
    const args = sandboxArgs({name: 'test-owned', image: 'image@sha256:' + 'a'.repeat(64), cwd: '/trusted', file: 'e2e-tests/playwright/specs/x.spec.ts', candidate: '/artifact/candidate', config: {CI: 'true', HOME: '/tmp'}, runtime: {results: '/artifact/run/results'}, framework: 'playwright', command: ['node', 'cli.js']});
    assert.ok(args.includes('--read-only')); assert.ok(args.includes('--cap-drop=ALL')); assert.ok(args.includes('--security-opt=no-new-privileges'));
    assert.ok(args.includes('type=bind,src=/trusted,dst=/work,readonly'));
    assert.ok(args.includes('type=bind,src=/artifact/candidate,dst=/work/e2e-tests/playwright/specs/x.spec.ts,readonly'));
    assert.ok(!args.some(a => /docker.sock|--privileged|--pid(?:=|$)|GH_TOKEN|OPENAI_API_KEY/.test(a)));
    assert.throws(() => sandboxArgs({name: 'x', image: 'x', cwd: '/x', file: 'x', candidate: '/x', config: {GH_TOKEN: 'secret'}, runtime: {}, framework: 'playwright', command: ['node']}), /Secret-like/);
});

function publicationMock({reviewFails = false, uncertainPR = false} = {}) {
    const calls = []; let receipt = false; let created = false;
    const item = {id: 'repair-id', attempt: 1, repository, commit_sha: sha, stable_key: 'MM-T1', owner: '@mattermost/qa', image_digest: 'mm/server@sha256:' + 'a'.repeat(64)};
    const file = 'e2e-tests/playwright/specs/x.spec.ts';
    const pr = {number: 42, state: 'open', html_url: `https://github.com/${repository}/pull/42`, head: {sha: 'b'.repeat(40)}};
    const gh = async (path, body, method, signal) => {
        calls.push({path, method});
        if (body) { assert.equal(method, 'POST'); assert.equal(signal?.aborted, false); }
        if (path === '/git/ref/heads/master') return {object: {sha}};
        if (path === `/contents/${file}?ref=${sha}`) return {type: 'file', content: Buffer.from('original').toString('base64')};
        if (path.startsWith('/pulls?')) return created ? [pr] : [];
        if (path.startsWith('/git/ref/heads/codex/triage-')) {const e = Error('404'); e.status = 404; throw e;}
        if (path === `/git/commits/${sha}`) return {tree: {sha: 'tree'}};
        if (path === '/git/trees') return {sha: 'tree-new'};
        if (path === '/git/commits') return {sha: 'b'.repeat(40)};
        if (path === '/git/refs') {assert.equal(body.ref, 'refs/heads/codex/triage-repair-id'); return {object: {sha: 'b'.repeat(40)}};}
        if (path.startsWith(`/contents/${file}?ref=`)) return {type: 'file', content: Buffer.from('candidate').toString('base64')};
        if (path === `/git/commits/${'b'.repeat(40)}`) return {parents: [{sha}]};
        if (path === '/pulls') {created = true; if (uncertainPR) throw Error('network response lost'); return pr;}
        if (path === '/pulls/42/files?per_page=100') return [{filename: file}];
        if (path === '/pulls/42/requested_reviewers') {assert.ok(receipt, 'receipt must persist first'); if (reviewFails) throw Error('review request unavailable'); return {};}
        assert.fail(path);
    };
    return {calls, args: {gh, item, file, source: 'candidate', original: 'original', account: 'Specific verified test stabilization', evidenceURL: 'https://github.com/mattermost/mattermost/actions/runs/55', count: 3, signal: new AbortController().signal, onPublished: async () => {receipt = true;}}};
}
test('repair receipt is persisted before a failing reviewer request', async () => {
    const mock = publicationMock({reviewFails: true});
    await assert.rejects(publishRepair(mock.args), /review request unavailable/);
    assert.equal(mock.calls.filter(c => c.path === '/pulls').length, 1);
});
test('uncertain PR POST response reconciles existing PR without retrying creation', async () => {
    const mock = publicationMock({uncertainPR: true});
    assert.match(await publishRepair(mock.args), /pull\/42$/);
    assert.equal(mock.calls.filter(c => c.path === '/pulls').length, 1);
});
test('lease loss before a GitHub mutation fences every remaining publication write', async () => {
    const mock = publicationMock(); let fences = 0;
    await assert.rejects(publishRepair({...mock.args, fence: async () => { if (++fences === 3) throw Error('lease lost'); }}), /lease lost/);
    assert.deepEqual(mock.calls.filter(c => c.method === 'POST').map(c => c.path), ['/git/trees', '/git/commits']);
});
test('diagnosis comment renders baseline metrics without calling them innocent/red-run proof', async () => {
    const {comment} = await import('./triage-diagnose.mjs');
    const body = comment({id: 'v1', outcome: 'unknown', reasons: ['Incomplete upload'], tests: [{stable_key: 'MM-T1', file: 'specs/x.spec.ts', baseline_runs: 8, baseline_failures: 3, baseline_failed_runs: 1, baseline_flaky_runs: 2, baseline_group_ids: ['baseline-id']}]}, workflow, group, 'https://tsio.example/api/v1');
    assert.match(body, /Unknown: evidence/); assert.match(body, /had failed attempts in 3 of 8 master runs/);
    assert.match(body, /1 ended failed; 2 had retry-surviving failures/); assert.match(body, /all tests and stored verdict/);
});
test('Cypress sandbox carries trusted bootstrap configuration through a safe expose allowlist', async () => {
    const {cypressRuntime} = await import('./triage-harness.mjs');
    const expose = cypressRuntime({services: {cypress: {environment: {CYPRESS_firstTest: 'true', CYPRESS_resetBeforeTest: 'true', CYPRESS_dbConnection: 'postgres://test/test', CYPRESS_ldapServer: 'localhost', AUTOMATION_DASHBOARD_TOKEN: 'secret', CYPRESS_customSecret: 'secret'}}}}, 'enterprise');
    assert.deepEqual(expose, {firstTest: true, resetBeforeTest: true, dbConnection: 'postgres://test/test', ldapServer: 'localhost', serverEdition: 'E20'});
});
test('discovery enqueues only latest stable-key observation and reconciles product defects', async () => {
    const {discover} = await import('./triage-queue.mjs'); const calls = [];
    const summaries = ['new', 'old'].map(id => ({...group, id, branch: 'master', status: 'completed', created_at: new Date().toISOString()}));
    const tsio = async (path, body) => {
        calls.push({path, body});
        if (path.startsWith('/reports?')) return {reports: summaries, total: 2};
        if (path.startsWith('/tests/evidence?')) return {complete: true, truncated: false, failure_count: 1, group: {...group, id: path.endsWith('new') ? 'new' : 'old', framework: 'playwright', branch: 'master', gh_pr_number: null}};
        if (path.startsWith('/triage/attribution?')) return {tests: [{framework: 'playwright', file: 'specs/x.spec.ts', stable_key: 'MM-T1'}]};
        if (path === '/triage/repairs/enqueue') {assert.equal(body.report_group_id, 'new'); assert.equal(body.ticket, undefined); return {item: {id: 'repair', state: 'product_suspect', lease_token: 'new-token', owner: '@qa'}};}
        if (path === '/triage/repairs/repair/defect') {assert.equal(body.lease_token, 'new-token'); return {};}
        assert.fail(path);
    };
    await discover({tsio, gh: async () => ({...workflow, path: '.github/workflows/e2e-tests-on-merge.yml'}), repository, git: async () => ({}), owners: async () => '/e2e-tests/ @qa'});
    assert.equal(calls.filter(c => c.path === '/triage/repairs/enqueue').length, 1);
    assert.equal(calls.filter(c => c.path === '/triage/repairs/repair/defect').length, 1);
});
test('repair counters inspect actual GitHub merged state and deduplicate recorded URLs', async () => {
    const {observeRepairs} = await import('./triage-metrics.mjs'); let reads = 0;
    const metric = await observeRepairs({repository, tsio: async () => ({items: [{attempts: [{pr_url: `https://github.com/${repository}/pull/42`}, {pr_url: `https://github.com/${repository}/pull/42`}]}], truncated: false}), gh: async path => {assert.equal(path, '/pulls/42'); reads++; return {number: 42, merged: true, state: 'closed', base: {repo: {full_name: repository}}};}});
    assert.equal(reads, 1); assert.equal(metric.opened_prs, 1); assert.equal(metric.merged_prs, 1); assert.equal(metric.closed_unmerged_prs, 0);
});
test('human timeout method decrease allowed and increase blocked; timers remain prohibited', () => {
    assert.equal(checkSource('test.setTimeout(100);', 'test.setTimeout(50);', 'x.spec.ts').errors.length, 0);
    assert.ok(checkSource('test.setTimeout(100);', 'test.setTimeout(200);', 'x.spec.ts').errors.length);
    assert.ok(checkSource('', 'setTimeout(done, 10);', 'x.spec.ts').errors.length);
});
