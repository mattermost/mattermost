import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, readFile, writeFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, dirname} from 'node:path';
import {run} from './triage-lib.mjs';
import {parseInputs, readClients, deriveItem, inspectCandidate, verifyRepair} from './triage-verify-repair.mjs';

const repository = 'mattermost/mattermost';
const file = 'e2e-tests/playwright/specs/a.spec.ts';
const original = `test('MM-T1 saves', async ({page}) => { await page.getByRole('button', {name: 'Save'}).click(); await expect(page.getByText('Saved')).toBeVisible(); });\n`;
const candidate = original.replace('await page.getByRole', "await page.getByText('Ready').waitFor(); await page.getByRole");
const image = 'mattermost/server@sha256:' + 'c'.repeat(64);
const selected = (sha = 'a'.repeat(40)) => ({repository, commit_sha: sha, gh_run_id: '12', gh_run_attempt: '2', name: 'playwright-full-enterprise-master', stable_key: 'MM-T1'});
const evidence = (sha) => ({schema_version: 1, complete: true, truncated: false, trusted_source: true,
    group: {...selected(sha), id: 'group', branch: 'master', framework: 'playwright', status: 'completed'},
    source_workflow_sha: 'b'.repeat(40), source_workflow_ref: `${repository}/.github/workflows/e2e-tests-on-merge.yml@refs/heads/master`,
    reports: [{id: 'report', environment_metadata: {image_digest: image, server: 'onprem', license_secret_present: false, testcontainers: true, testcontainers_services: 'postgres', playwright_version: '1.55.0'}}],
    tests: [{id: 'case', report_id: 'report', stable_key: 'MM-T1', file, full_title: 'a.spec.ts > MM-T1 saves', project: 'chrome', status: 'failed', retry_count: 0, attempts: 1, attempts_failed: 1, run_failed: true, error_message: 'Expected Saved; received Saving'}]});
const baseline = () => [{file, title: 'a.spec.ts > MM-T1 saves', project: 'chrome', state: 'failed', attempts: 1, retry: 0, errors: ['Expected Saved; received Saving']}];

test('inputs accept only the exact selector and an explicit allowed TSIO API', async () => {
    const env = {GITHUB_REPOSITORY: repository, REPAIR_PR_NUMBER: '42', REPAIR_EVIDENCE_JSON: JSON.stringify(selected())};
    assert.deepEqual(parseInputs(env), {repository, prNumber: 42, selected: selected()});
    for (const value of [{...selected(), error_message: 'caller proof'}, {...selected(), gh_run_id: '../1'}, {...selected(), commit_sha: 'master'}, {...selected(), repository: 'attacker/repo'}]) {
        assert.throws(() => parseInputs({...env, REPAIR_EVIDENCE_JSON: JSON.stringify(value)}));
    }
    assert.throws(() => parseInputs({...env, REPAIR_PR_NUMBER: '42;echo bad'}));
    for (const url of ['https://evil.example/api/v1', 'https://test-io.test.mattermost.com/api/v1?x=1', 'https://test-io.test.mattermost.com/api/v1#x', 'https://user@test-io.test.mattermost.com/api/v1', 'https://test-io.test.mattermost.com/other']) {
        assert.throws(() => readClients({...env, GH_TOKEN: 'read-only', TSIO_URL: url}));
    }
    const calls = [];
    const api = readClients({...env, GH_TOKEN: 'read-only'}, async (url, options) => { calls.push({url: String(url), options}); return {ok: true, status: 200, json: async () => ({})}; });
    await api.tsio('/triage/run-evidence?name=example'); await api.gh('/pulls/42');
    assert.equal(calls[0].url, 'https://test-io.test.mattermost.com/api/v1/triage/run-evidence?name=example');
    assert.equal(calls[0].options.headers.Authorization, undefined);
    assert.equal(calls[1].options.headers.Authorization, 'Bearer read-only');
    assert.ok(calls.every(c => c.options.method === 'GET' && !c.options.body && c.options.redirect === 'error'));
});

test('all item fields derive from trusted exact raw evidence, including consistent immutable environments', () => {
    const ev = evidence(); const item = deriveItem(selected(), ev, 42);
    assert.equal(item.image_digest, image); assert.equal(item.file, file);
    assert.equal(item.source_workflow_sha, ev.source_workflow_sha);
    assert.notEqual(item.source_workflow_sha, item.commit_sha);
    for (const mutate of [e => { e.trusted_source = false; }, e => { e.group.gh_run_attempt = '1'; },
        e => { e.tests.push({...e.tests[0]}); }, e => { e.tests[0].attempts = null; },
        e => { e.tests.push({...e.tests[0], id: 'collision', file: 'specs/another.spec.ts'}); },
        e => { e.reports[0].environment_metadata.server_image_digest = 'mattermost/server@sha256:' + 'd'.repeat(64); }]) {
        const broken = evidence(); mutate(broken); assert.throws(() => deriveItem(selected(), broken, 42));
    }
    ev.reports.push({...ev.reports[0], id: 'report2', environment_metadata: {...ev.reports[0].environment_metadata, worker_index: 2, project: 'chrome'}});
    ev.tests.push({...ev.tests[0], id: 'case2', report_id: 'report2'});
    assert.equal(deriveItem(selected(), ev, 42).image_digest, image);
    ev.reports[1].environment_metadata.license_secret_present = true;
    assert.throws(() => deriveItem(selected(), ev, 42), /environment/);
});

async function fixture(t, {source = candidate, extraFile = false, deleted = false, symlink = false} = {}) {
    const cwd = await mkdtemp(join(tmpdir(), 'repair-verifier-test-')); t.after(() => rm(cwd, {recursive: true, force: true}));
    const git = async (...args) => (await run('git', args, {cwd})).stdout.trim();
    await git('init', '-b', 'master'); await git('config', 'user.name', 'Fixture'); await git('config', 'user.email', 'fixture@example.invalid');
    await mkdir(dirname(join(cwd, file)), {recursive: true}); await writeFile(join(cwd, file), original);
    await writeFile(join(cwd, 'CODEOWNERS'), '/e2e-tests/playwright/ @yasserfaraazkhan\n');
    await git('add', '.'); await git('commit', '-m', 'trusted original'); const base = await git('rev-parse', 'HEAD');
    await git('checkout', '-b', 'repair');
    if (deleted) await git('rm', '--', file);
    else if (symlink) { await rm(join(cwd, file)); await run('ln', ['-s', '/tmp/other', join(cwd, file)]); }
    else await writeFile(join(cwd, file), source);
    if (extraFile) await writeFile(join(cwd, 'unrelated.js'), 'process.exit(0);\n');
    await git('add', '.'); await git('commit', '-m', 'candidate'); const head = await git('rev-parse', 'HEAD');
    await git('update-ref', 'refs/remotes/origin/triage-repair-head', head);
    await git('checkout', 'master'); await writeFile(join(cwd, 'unrelated.txt'), 'master advanced\n');
    await git('add', '.'); await git('commit', '-m', 'unrelated master advance');
    await git('update-ref', 'refs/remotes/origin/master', 'HEAD'); const master = await git('rev-parse', 'HEAD');
    const pr = {number: 42, state: 'open', changed_files: extraFile ? 2 : 1, base: {ref: 'master', repo: {full_name: repository}}, head: {sha: head}, html_url: `https://github.com/${repository}/pull/42`};
    return {cwd, git, base, head, master, pr};
}

test('actual Git objects allow unrelated master advance and isolate only the single bounded test edit', async t => {
    const f = await fixture(t); const result = await inspectCandidate(f.cwd, f.pr, deriveItem(selected(f.base), evidence(f.base), 42));
    assert.equal(result.original, original); assert.equal(result.source, candidate); assert.equal(result.master, f.master);
    assert.notEqual(result.master, f.base); assert.equal(result.mergeBase, f.base);
    assert.equal(await readFile(join(f.cwd, file), 'utf8'), original);
});

for (const [name, options] of [['extra changed file', {extraFile: true}], ['deleted test', {deleted: true}], ['symlink test', {symlink: true}], ['oversized change', {source: candidate + '\n'.repeat(151)}]]) {
    test(`actual Git candidate rejects ${name}`, async t => {
        const f = await fixture(t, options); f.pr.changed_files = 1; // Do not trust the API count alone.
        await assert.rejects(inspectCandidate(f.cwd, f.pr, deriveItem(selected(f.base), evidence(f.base), 42)));
    });
}

test('stale target source and a PR head mismatch stop before test execution', async t => {
    const f = await fixture(t); const item = deriveItem(selected(f.base), evidence(f.base), 42);
    await assert.rejects(inspectCandidate(f.cwd, {...f.pr, head: {sha: f.base}}, item), /head/);
    await writeFile(join(f.cwd, file), original + '// changed on master\n'); await f.git('add', '.'); await f.git('commit', '-m', 'target changed'); await f.git('update-ref', 'refs/remotes/origin/master', 'HEAD');
    await assert.rejects(inspectCandidate(f.cwd, f.pr, item), /Master test changed/);
});

async function exercise(t, {baselineResult = baseline(), source = candidate, mutatePass, race, sourceMismatch = false, setupRewrite} = {}) {
    const f = await fixture(t, {source}); const output = join(f.cwd, 'artifacts'); const labels = []; let applied = false; let checkoutCalls = 0; let prReads = 0;
    const sourceRun = {repository: {full_name: repository}, path: '.github/workflows/e2e-tests-on-merge.yml', status: 'completed', run_attempt: 2, head_sha: sourceMismatch ? f.base : 'b'.repeat(40), head_branch: 'master', id: 12};
    const gh = async path => {
        if (path === '/pulls/42') { prReads++; return prReads > 1 && race === 'head' ? {...f.pr, head: {sha: f.base}} : f.pr; }
        if (path === '/pulls/42/files?per_page=100') return [{filename: file, status: 'modified'}];
        if (path === '/actions/runs/12/attempts/2') return sourceRun;
        throw new Error('Unexpected GitHub request ' + path);
    };
    const execute = verifyRepair({repository, prNumber: 42, selected: selected(f.base), output, controllerSHA: f.master, gh,
        tsio: async path => { assert.match(path, /^\/triage\/run-evidence\?/); return evidence(f.base); },
        checkout: async () => { checkoutCalls++; return f.cwd; },
        refresh: async () => { if (race === 'target') { await f.git('checkout', 'master'); await writeFile(join(f.cwd, file), original + '//new master edit\n'); await f.git('add', file); await f.git('commit', '-m', 'target race'); await f.git('update-ref', 'refs/remotes/origin/master', 'HEAD'); } },
        createHarness: async (item, cwd) => {
            assert.equal(await f.git('rev-parse', 'HEAD'), f.base);
            assert.equal(await readFile(join(cwd, file), 'utf8'), original);
            const path = join(output, 'candidate-source.ts'); await writeFile(path, original);
            if (setupRewrite === 'sandbox') await writeFile(path, original + '// rewritten by setup\n');
            if (setupRewrite === 'host') await writeFile(join(cwd, file), original + '// rewritten by setup\n');
            return {candidate: path, apply: async value => { applied = true; await writeFile(path, value); }, execute: async label => {
                labels.push(label); if (label === 'reproduction') { assert.equal(applied, false); return baselineResult; }
                assert.equal(await readFile(path, 'utf8'), source);
                const passing = baseline().map(row => ({...row, state: 'passed', errors: []})); mutatePass?.(passing, labels.length);
                return passing;
            }};
        }});
    return {f, output, execute, labels, applied: () => applied, checkoutCalls: () => checkoutCalls};
}

test('complete orchestration reproduces first, applies candidate only in sandbox, verifies five clean runs and records exact tested base', async t => {
    const e = await exercise(t); const result = await e.execute;
    assert.deepEqual(e.labels, ['reproduction', 'verification-1', 'verification-2', 'verification-3', 'verification-4', 'verification-5']);
    assert.equal(result.tested_base_sha, e.f.base); assert.equal(result.pr_head_sha, e.f.head); assert.equal(result.current_master_sha, e.f.master);
    assert.equal(result.clean_runs, 5); assert.equal(result.reviewer, '@yasserfaraazkhan'); assert.equal(result.automatic_merge, false);
    assert.equal(await readFile(join(e.f.cwd, file), 'utf8'), original);
    assert.equal(JSON.parse(await readFile(join(e.output, 'verification.json'), 'utf8')).outcome, 'verified');
});

test('different reproduction failure never applies candidate', async t => {
    const rows = baseline(); rows[0].errors = ['Setup timed out']; const e = await exercise(t, {baselineResult: rows});
    await assert.rejects(e.execute, /recorded failure/); assert.equal(e.applied(), false); assert.deepEqual(e.labels, ['reproduction']);
    assert.equal(JSON.parse(await readFile(join(e.output, 'blocked.json'), 'utf8')).outcome, 'blocked');
});

for (const setupRewrite of ['sandbox', 'host']) test(`setup cannot rewrite the ${setupRewrite} original and call it reproduction`, async t => {
    const e = await exercise(t, {setupRewrite});
    await assert.rejects(e.execute, /changed the recorded original test source/);
    assert.deepEqual(e.labels, []);
    assert.equal(e.applied(), false);
});

test('workflow revision is independently checked before checkout or execution', async t => {
    const e = await exercise(t, {sourceMismatch: true}); await assert.rejects(e.execute, /workflow revision/); assert.equal(e.checkoutCalls(), 0);
});

test('strict edit policy stops a candidate which disables an original assertion', async t => {
    const e = await exercise(t, {source: original.replace('await expect', 'if (false) await expect')});
    await assert.rejects(e.execute, /control|assertion/i); assert.equal(e.applied(), false); assert.equal(e.labels.length, 0);
});

for (const [name, mutatePass] of [['wrong file', rows => { rows[0].file = file.replace('a.spec', 'b.spec'); }], ['retry', rows => { rows[0].attempts = 2; }], ['duplicate identity', rows => { rows.push({...rows[0]}); }], ['failed run', rows => { rows[0].state = 'failed'; }]]) {
    test(`verification cannot pass with ${name}`, async t => { const e = await exercise(t, {mutatePass}); await assert.rejects(e.execute); });
}
for (const race of ['head', 'target']) {
    test(`a changed ${race} during five runs prevents a verified receipt`, async t => { const e = await exercise(t, {race}); await assert.rejects(e.execute, /head|Master test changed/); });
}

test('workflow has only read permissions and never checks out PR code, passes a model credential, or writes a status', async () => {
    const source = await readFile(new URL('../workflows/e2e-triage-verify-repair.yml', import.meta.url), 'utf8');
    assert.match(source, /workflow_dispatch:/); assert.match(source, /pr_number:/); assert.match(source, /evidence_json:/);
    assert.match(source, /github\.ref == 'refs\/heads\/master'/); assert.match(source, /ref: \$\{\{ github\.sha \}\}/);
    assert.doesNotMatch(source, /:\s*write\b|pull_request_target|OPENAI|ANTHROPIC|CURSOR|TSIO_TRIAGE_API_KEY|MM_TRIAGE_GITHUB_TOKEN|id-token:/);
    assert.match(source, /persist-credentials: false/); assert.match(source, /if: always\(\)/);
});
