// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {describe, it} from 'node:test';
import {mkdtempSync, readFileSync, writeFileSync, rmSync, mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, join} from 'node:path';
import {compareSuite, fetchJobs, fetchJson, globMatcher, hash, loadPlans, main, summaryMarkdown, workerContract} from './impact-gate-compare.mjs';

function fixture(framework = 'cypress', variant = 'enterprise') {
    const identity = {repository: 'mattermost/mattermost', tested_sha: 'a'.repeat(40), base_sha: 'b'.repeat(40), workflow_sha: 'c'.repeat(40), planner_sha: 'd'.repeat(40), run_id: '123', run_attempt: '2'};
    const root = `e2e-tests/${framework}`;
    const paths = framework === 'cypress' ? ['tests/integration/failed_spec.js', 'tests/integration/retry_spec.js', 'tests/integration/skip_spec.js'] : ['specs/failed.spec.ts', 'specs/retry.spec.ts', 'specs/skip.spec.ts'];
    const suite = {id: `${framework}-full-${variant}`, framework, root, configFile: `${root}/config.ts`, project: framework === 'cypress' ? root : 'chrome', browser: framework === 'cypress' ? 'default (not recorded in TSIO)' : 'chromium', variant, specPattern: framework === 'cypress' ? 'tests/integration/**/*_spec.{js,ts}' : 'specs/**/*.{spec,test}.{ts,tsx,js,jsx,mjs,cjs,mts,cts}'};
    const config = {repository: identity.repository, sourcePatterns: ['webapp/**'], crossCuttingPatterns: [], suites: [suite], mappings: []};
    const inventory = paths.map((path) => `${root}/${path}`).sort();
    const context = {mergeBase: identity.base_sha, changes: ['webapp/source.ts'], entries: new Map([...inventory, suite.configFile].map((path) => [path, {mode: '100644', type: 'blob'}])), bytes: () => Buffer.from('data only'), regularFile(path) {assert.ok([...inventory, suite.configFile].includes(path), 'Not a regular committed file');}};
    const advisory = {mode: 'advisory', repository: identity.repository, headSha: identity.tested_sha, baseSha: identity.base_sha, requestedBaseSha: identity.base_sha, changedFiles: context.changes, changedFilesSha256: hash(JSON.stringify(context.changes)), configurationSha256: hash(JSON.stringify(config)), suite: {...suite, configSha256: hash('data only')}, inventoryStatus: 'static-spec-files', inventory, selectedSpecs: inventory, executionPolicy: 'retain-full-suite', diffStatus: 'changed', evidence: {coverage: 'unavailable', execution: 'unavailable', release: 'not-assessed', measuredCoverageEdges: 0}, mappings: [], fileAssessments: [{file: context.changes[0], status: 'unmapped', reason: 'No reviewed mapping'}], fullSuiteFallbackReasons: ['No reviewed mapping']};
    const plan = {schemaVersion: '1.0.0', sourceRunId: `github:${identity.repository}:${identity.run_id}:${identity.run_attempt}`, advisory, confidence: null, confidenceKind: 'unavailable', runSet: 'full', recommendedTests: inventory, enforcement: {mode: 'advisory', shouldFail: false}, decision: {action: 'run-now'}};
    const {count, prefix} = workerContract(suite);
    const jobs = {total_count: count + 1, jobs: Array.from({length: count}, (_, i) => ({id: (framework === 'cypress' ? 1000 : 2000) + i, name: `${prefix}${i + 1}`, run_id: Number(identity.run_id), run_attempt: Number(identity.run_attempt), head_sha: identity.workflow_sha, status: 'completed', conclusion: i === 0 ? 'failure' : 'success', run_url: `https://api.github.com/repos/${identity.repository}/actions/runs/${identity.run_id}`}))};
    // The summary job and overall workflow need not be terminal yet.
    jobs.jobs.push({id: 9999, name: 'advisory-comparison', status: 'in_progress'});
    const common = {id: `${framework === 'cypress' ? '1' : '2'}1234567-1234-1234-1234-123456789abc`, repository: identity.repository, commit_sha: identity.tested_sha, gh_run_id: identity.run_id, gh_run_attempt: identity.run_attempt, name: suite.id, framework, status: 'completed'};
    const evidence = {complete: true, truncated: false, cluster_count: 1, failure_count: 2, group: {...common, total_reports_expected: count, reports_registered: count, reports_complete: count, environment_metadata: {server: 'onprem', server_edition: variant, playwright_project: suite.project, test_type: 'full'}}, clusters: [{member_count: 2, members: [{stable_key: 'reused-key', full_title: 'Failed behavior', status: 'failed'}, {stable_key: 'other-key', full_title: 'Retry survivor', status: 'flaky'}], representative: {file: 'another-spec.js', full_title: 'Another cluster representative'}}]};
    const detail = {...common, commit: identity.tested_sha, total_reports_expected: count, reports: jobs.jobs.slice(0, count).map((job) => ({id: `report-${job.id}`, status: 'complete', gh_job_id: String(job.id), gh_job_name: job.name}))};
    const units = paths.map((path, i) => ({spec_path: path, state: ['completed_fail', 'completed_pass', 'completed_skipped'][i], current_lease: null, outcome_set_at: '2026-09-08T00:00:01Z', attempts: [{id: `attempt-${i}`, spec_path: path, gh_job_id: String(jobs.jobs[i].id), gh_job_name: jobs.jobs[i].name, reported_at: '2026-09-08T00:00:01Z', expired: false, late_report: false, status: ['failed', 'flaky', 'skipped'][i], test_cases: [{full_title: ['Failed behavior', 'Retry survivor', 'Skipped behavior'][i], status: ['failed', 'flaky', 'skipped'][i]}]}]}));
    const orchestration = {...common, total_units: units.length, counts: {pending: 0, leased: 0, abandoned: 0, retest_eligible: 0, completed_fail: 1, completed_pass: 1, completed_skipped: 1}, units};
    return {input: {plan, evidence, detail, orchestration}, shared: {config, identity, jobs, context}};
}
const compare = (f) => compareSuite(f.input, f.shared);

describe('advisory comparison provenance and worker completeness', () => {
    for (const framework of ['cypress', 'playwright']) for (const variant of ['enterprise', 'fips']) {
        it(`compares ${framework}/${variant}, including a nonterminal summary job`, () => {
            const result = compare(fixture(framework, variant));
            assert.equal(result.status, 'complete');
            assert.equal(result.observed_failure_selection_recall.rate, 1);
            assert.equal(result.observed_failure_selection_recall.total, 1);
            assert.equal(result.retry_survivors_excluded.length, 1);
            assert.equal(result.selection.dispatched_skipped, 1);
        });
    }
    for (const [name, mutate, error] of [
        ['tested SHA', (f) => {f.input.plan.advisory.headSha = 'e'.repeat(40);}, /Git provenance/],
        ['source attempt', (f) => {f.input.plan.sourceRunId = 'github:mattermost/mattermost:123:1';}, /sourceRunId/],
        ['TSIO attempt', (f) => {f.input.evidence.group.gh_run_attempt = '1';}, /TSIO.*identity/],
        ['worker workflow SHA', (f) => {f.shared.jobs.jobs[0].head_sha = f.shared.identity.tested_sha;}, /workflow-SHA/],
        ['project', (f) => {f.input.evidence.group.environment_metadata.playwright_project = 'firefox';}, /project/],
        ['edition', (f) => {f.input.evidence.group.environment_metadata.server_edition = 'fips';}, /edition/],
        ['traversal selection', (f) => {f.input.plan.advisory.selectedSpecs = ['../outside.spec.ts'];}, /path/],
        ['incomplete full fallback', (f) => {f.input.plan.advisory.selectedSpecs = f.input.plan.advisory.inventory.slice(1); f.input.plan.recommendedTests = f.input.plan.advisory.selectedSpecs;}, /omitted inventory/],
        ['invented inventory', (f) => {f.input.plan.advisory.inventory = f.input.plan.advisory.inventory.slice(1);}, /inventory mismatch/],
        ['missing changed path', (f) => {f.input.plan.advisory.changedFiles = [];}, /changed-file/],
        ['self-declared mappings', (f) => {f.shared.config.mappings = [{provenance: {kind: 'human-reviewed-manifest'}}];}, /unreviewed mapping/],
    ]) it(`rejects ${name} mismatch`, () => {const f = fixture('playwright'); mutate(f); assert.throws(() => compare(f), error);});

    for (const [name, mutate] of [
        ['missing worker', (f) => {f.input.detail.reports.pop();}],
        ['substituted worker', (f) => {f.input.detail.reports[0].gh_job_id = '333333';}],
        ['same-count substituted worker name', (f) => {f.shared.jobs.jobs[0].name = f.shared.jobs.jobs[0].name.replace('dispatch-run-1', 'dispatch-run-99');}],
        ['incomplete evidence', (f) => {f.input.evidence.complete = false;}],
        ['truncated evidence', (f) => {f.input.evidence.truncated = true;}],
        ['unfinished units', (f) => {f.input.orchestration.units[2].state = 'leased';}],
        ['terminal failed unit without failed tests', (f) => {f.input.orchestration.units[0].attempts[0].test_cases[0].status = 'passed';}],
        ['late terminal report', (f) => {f.input.orchestration.units[0].attempts[0].late_report = true;}],
        ['expired terminal report', (f) => {f.input.orchestration.units[0].attempts[0].expired = true;}],
        ['wrong terminal attempt timestamp', (f) => {f.input.orchestration.units[0].outcome_set_at = '2026-09-08T00:01:00Z';}],
    ]) it(`reports recall unavailable for ${name}`, () => {
        const f = fixture(); mutate(f);
        if (name === 'same-count substituted worker name') f.input.orchestration.units[0].attempts[0].gh_job_name = f.shared.jobs.jobs[0].name;
        const result = compare(f);
        assert.equal(result.status, 'unavailable');
        assert.equal(result.observed_failure_selection_recall.rate, null);
        assert.equal(result.observed_failure_selection_recall.total, null);
        assert.ok(result.unavailable_reasons.length);
    });

    it('retains observed counts with a missing worker report, without a validated denominator', () => {
        const f = fixture(); f.input.detail.reports.pop();
        const result = compare(f);
        assert.deepEqual(result.observed_counts, {final_failed_specs: 1, included_failed_specs: 1, missed_failed_specs: 0});
        assert.equal(result.observed_failure_selection_recall.total, null);
        assert.equal(result.workers.missing_worker_ids.length, 1);
    });
    it('cannot omit an orchestration unit while complete reports still contain its failure', () => {
        const f = fixture();
        f.input.orchestration.units.shift();
        f.input.orchestration.total_units--;
        f.input.orchestration.counts.completed_fail--;
        const result = compare(f);
        assert.equal(result.status, 'unavailable');
        assert.equal(result.observed_failure_selection_recall.total, null);
        assert.match(result.unavailable_reasons.join('; '), /failure member.*missing/i);
    });
    it('cannot disambiguate a failure-member title shared across different dispatched specs', () => {
        const f = fixture();
        f.input.orchestration.units[1].attempts[0].test_cases.push({full_title: 'Failed behavior', status: 'passed'});
        const result = compare(f);
        assert.equal(result.status, 'unavailable');
        assert.equal(result.observed_failure_selection_recall.total, null);
        assert.match(result.unavailable_reasons.join('; '), /failure member.*ambiguous/i);
    });
    it('matches report failures to earlier attempts without adding retry survivors to the denominator', () => {
        const f = fixture();
        const unit = f.input.orchestration.units[0];
        const original = unit.attempts[0];
        unit.attempts.unshift({...original, id: 'earlier-attempt', reported_at: '2026-09-08T00:00:00Z', test_cases: [{full_title: 'Earlier reported failure', status: 'failed'}]});
        f.input.evidence.clusters[0].members[0].full_title = 'Earlier reported failure';
        original.status = 'passed';
        original.test_cases[0].status = 'passed';
        unit.state = 'completed_pass';
        f.input.orchestration.counts.completed_fail = 0;
        f.input.orchestration.counts.completed_pass = 2;
        const result = compare(f);
        assert.equal(result.status, 'complete');
        assert.equal(result.observed_failure_selection_recall.total, 0);
        assert.equal(result.observed_failure_selection_recall.rate, null);
        assert.equal(result.retry_survivors_excluded.length, 2);
    });
    it('separates registered pending units from specs actually dispatched to a worker', () => {
        const f = fixture();
        f.input.orchestration.units[2].state = 'pending';
        f.input.orchestration.units[2].attempts = [];
        f.input.orchestration.counts.completed_skipped = 0;
        f.input.orchestration.counts.pending = 1;
        const result = compare(f);
        assert.equal(result.selection.registered_units, 3);
        assert.equal(result.selection.total_dispatched, 2);
        assert.equal(result.selection.selected_dispatched, 2);
        assert.equal(result.observed_failure_selection_recall.rate, null);
    });
    it('does not require every failure to be the cluster representative or use stable-key history', () => {
        const f = fixture();
        f.input.evidence.clusters[0].representative = {stable_key: 'unrelated', file: 'different.js', full_title: 'Unrelated representative'};
        assert.equal(compare(f).observed_failure_selection_recall.total, 1);
    });
    for (const empty of [false, true]) it(`leaves a ${empty ? 'zero-dispatch' : 'no-failure'} denominator undefined`, () => {
        const f = fixture();
        f.input.orchestration.units = empty ? [] : f.input.orchestration.units.slice(1);
        f.input.orchestration.total_units = f.input.orchestration.units.length;
        f.input.orchestration.counts.completed_fail = 0;
        if (empty) {f.input.orchestration.counts.completed_pass = 0; f.input.orchestration.counts.completed_skipped = 0;}
        // Report evidence agrees: only the retained retry survivor had failed
        // attempts, or there were no observations in the zero-dispatch case.
        f.input.evidence.clusters[0].members = empty ? [] : f.input.evidence.clusters[0].members.slice(1);
        f.input.evidence.clusters[0].member_count = f.input.evidence.clusters[0].members.length;
        f.input.evidence.failure_count = f.input.evidence.clusters[0].member_count;
        const result = compare(f);
        assert.equal(result.status, 'complete');
        assert.equal(result.observed_failure_selection_recall.total, 0);
        assert.equal(result.observed_failure_selection_recall.rate, null);
    });
    it('keeps substantive output deterministic and renders table rows before explanations', () => {
        const f = fixture(); assert.deepEqual(compare(f), compare(f));
        f.input.evidence.complete = false;
        const markdown = summaryMarkdown({suites: [compare(f), compare(fixture('playwright'))]});
        assert.ok(markdown.indexOf('| playwright-full-enterprise') < markdown.indexOf('cypress-full-enterprise:'));
    });
});

it('runs the runtime bridge from trusted Git data, writes bounded evidence, and rejects stale sidecar provenance before fetching', async () => {
    const temp = mkdtempSync(join(tmpdir(), 'impact-comparison-runtime-'));
    const previousCwd = process.cwd();
    const originalFetch = global.fetch;
    const root = join(temp, 'workflow');
    const planner = join(temp, 'planner');
    const plansDir = join(temp, 'plans');
    const output = join(temp, 'output');
    const git = (cwd, ...args) => execFileSync('git', ['-c', 'commit.gpgsign=false', '-c', 'core.hooksPath=/dev/null', ...args], {cwd, encoding: 'utf8', env: {...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1'}}).trim();
    const write = (path, data) => {mkdirSync(dirname(path), {recursive: true}); writeFileSync(path, data);};
    try {
        const fixtures = [fixture('cypress'), fixture('playwright')];
        for (const directory of [root, planner]) {
            mkdirSync(directory); git(directory, 'init', '-q'); git(directory, 'config', 'user.name', 'Comparison fixture'); git(directory, 'config', 'user.email', 'fixture@example.invalid');
        }
        git(root, 'remote', 'add', 'origin', 'https://github.com/mattermost/mattermost.git');
        for (const f of fixtures) {
            for (const file of f.input.plan.advisory.inventory) write(join(root, file), 'throw new Error("PR code must never execute");');
            write(join(root, f.input.plan.advisory.suite.configFile), 'data only');
        }
        write(join(root, 'webapp/source.ts'), 'base'); git(root, 'add', '.'); git(root, 'commit', '-qm', 'Base');
        const base = git(root, 'rev-parse', 'HEAD');
        write(join(root, 'webapp/source.ts'), 'tested'); git(root, 'add', '.'); git(root, 'commit', '-qm', 'Tested');
        const tested = git(root, 'rev-parse', 'HEAD');
        write(join(root, 'trusted-workflow.txt'), 'trusted workflow'); git(root, 'add', '.'); git(root, 'commit', '-qm', 'Workflow');
        const workflow = git(root, 'rev-parse', 'HEAD');
        const config = {...fixtures[0].shared.config, suites: fixtures.map((f) => f.shared.config.suites[0])};
        const configPath = join(planner, 'advisory.config.json');
        write(configPath, JSON.stringify({advisory: config})); git(planner, 'add', '.'); git(planner, 'commit', '-qm', 'Pinned configuration');
        const identity = {...fixtures[0].shared.identity, base_sha: base, tested_sha: tested, workflow_sha: workflow, planner_sha: git(planner, 'rev-parse', 'HEAD')};
        const entries = [];
        for (const f of fixtures) {
            Object.assign(f.input.plan.advisory, {headSha: tested, requestedBaseSha: base, baseSha: base, configurationSha256: hash(JSON.stringify(config))});
            f.input.evidence.group.commit_sha = tested; f.input.detail.commit = tested; f.input.orchestration.commit_sha = tested;
            f.shared.jobs.jobs.forEach((job) => {job.head_sha = workflow;});
            const suite = f.input.plan.advisory.suite.id;
            const bytes = JSON.stringify(f.input.plan);
            write(join(plansDir, `${suite}.json`), bytes); entries.push({suite, file: `${suite}.json`, sha256: hash(bytes)});
        }
        const provenance = {...identity, plans: entries};
        write(join(plansDir, 'provenance.json'), JSON.stringify(provenance));
        const jobs = {jobs: fixtures.flatMap((f) => f.shared.jobs.jobs.filter((job) => job.id !== 9999))};
        jobs.total_count = jobs.jobs.length;
        const requests = [];
        global.fetch = async (url, options) => {
            requests.push({url, options});
            const target = new URL(url);
            if (target.hostname === 'api.github.com') return new Response(JSON.stringify(jobs));
            assert.equal(options.headers.Authorization, undefined);
            const fixture = target.searchParams.has('name') ? fixtures.find((f) => f.input.plan.advisory.suite.id === target.searchParams.get('name')) : fixtures.find((f) => target.pathname.endsWith(f.input.detail.id));
            assert.ok(fixture);
            return new Response(JSON.stringify(target.pathname.endsWith('/evidence') ? fixture.input.evidence : target.pathname.endsWith('/status') ? fixture.input.orchestration : fixture.input.detail));
        };
        process.chdir(root);
        const env = {GITHUB_REPOSITORY: identity.repository, GITHUB_SHA: workflow, GITHUB_RUN_ID: identity.run_id, GITHUB_RUN_ATTEMPT: identity.run_attempt, TESTED_SHA: tested, BASE_SHA: base, IMPACT_GATE_PLANNER_SHA: identity.planner_sha, IMPACT_GATE_CONFIG: configPath, IMPACT_GATE_PLANS: plansDir, COMPARISON_OUTPUT: output, TSIO_URL: 'https://example.test/api/v1', GH_TOKEN: 'sentinel', GITHUB_STEP_SUMMARY: join(temp, 'summary.md')};
        const result = await main(env);
        assert.ok(result.suites.every((suite) => suite.status === 'complete'), JSON.stringify(result.suites));
        assert.equal(result.source_receipts.length, 7);
        assert.equal(result.input_sha256.configuration, hash(readFileSync(configPath)));
        assert.equal(Object.keys(result.input_sha256.plans).length, 2);
        assert.equal(requests.length, 7);
        assert.ok(requests.every((request) => request.options.method === 'GET' && request.options.redirect === 'error'));
        assert.equal(git(root, 'status', '--porcelain'), '');
        assert.ok(readFileSync(join(output, 'summary.md'), 'utf8').includes('Existing full-suite execution is retained'));
        provenance.run_attempt = '1'; write(join(plansDir, 'provenance.json'), JSON.stringify(provenance));
        const unavailable = await main(env);
        assert.equal(unavailable.suites[0].status, 'unavailable');
        assert.equal(unavailable.suites[0].observed_failure_selection_recall.rate, null);
        assert.equal(requests.length, 7, 'Invalid artifact must not fetch execution evidence');
    } finally {process.chdir(previousCwd); global.fetch = originalFetch; rmSync(temp, {recursive: true, force: true});}
});

describe('bounded read-only API transport', () => {
    it('sends GitHub credentials only to api.github.com and never to TSIO', async () => {
        const requests = [];
        const fetchImpl = async (url, options) => {requests.push({url, ...options}); return new Response('{"ok":true}');};
        await fetchJson('https://example.test/api/v1/tests/evidence', {token: 'sentinel', fetchImpl});
        await fetchJson('https://api.github.com/repos/mattermost/mattermost/actions/runs/123/attempts/2/jobs', {github: true, token: 'sentinel', fetchImpl});
        assert.equal(requests[0].headers.Authorization, undefined);
        assert.equal(requests[1].headers.Authorization, 'Bearer sentinel');
        assert.ok(requests.every((request) => request.method === 'GET' && request.redirect === 'error'));
        await assert.rejects(fetchJson('https://other.test/path', {github: true, token: 'sentinel', fetchImpl}), /Unsafe API/);
        await assert.rejects(fetchJson('http://example.test/path', {fetchImpl}), /Unsafe API/);
    });
    it('rejects errors and malformed response JSON', async () => {
        await assert.rejects(fetchJson('https://example.test/path', {fetchImpl: async () => new Response('unavailable', {status: 503})}), /API read failed/);
        await assert.rejects(fetchJson('https://example.test/path', {fetchImpl: async () => new Response('{invalid')}));
        await assert.rejects(fetchJson('https://example.test/path', {fetchImpl: async () => new Response(Buffer.alloc(32 * 1024 * 1024 + 1))}), /exceeds 32 MiB/);
    });
    it('collects exact-attempt jobs with bounded complete pagination', async () => {
        const identity = fixture().shared.identity;
        const urls = [];
        const result = await fetchJobs(identity, async (url, github) => {
            assert.equal(github, true); urls.push(url);
            const second = url.endsWith('page=2');
            return {total_count: 101, jobs: Array.from({length: second ? 1 : 100}, (_, i) => ({id: second ? 101 : i + 1}))};
        });
        assert.equal(result.jobs.length, 101);
        assert.equal(urls.length, 2);
        assert.ok(urls.every((url) => url.includes('/runs/123/attempts/2/jobs?')));
        await assert.rejects(fetchJobs(identity, async () => ({total_count: 101, jobs: [{id: 1}]})), /Incomplete.*pagination/);
        await assert.rejects(fetchJobs(identity, async () => ({total_count: 2, jobs: [{id: 1}, {id: 1}]})), /Duplicate/);
    });
});

describe('artifact byte provenance and supported glob semantics', () => {
    it('validates sidecar bytes/revision and rejects artifact traversal or omitted suites', () => {
        const directory = mkdtempSync(join(tmpdir(), 'impact-comparison-artifact-'));
        try {
            const {identity} = fixture().shared;
            const plans = ['cypress', 'playwright'].map((framework) => {
                const {plan} = fixture(framework).input;
                const bytes = JSON.stringify(plan);
                const suite = plan.advisory.suite.id;
                const file = `${suite}.json`;
                writeFileSync(join(directory, file), bytes);
                return {suite, file, sha256: hash(bytes)};
            });
            const manifest = {...identity, plans};
            const save = () => writeFileSync(join(directory, 'provenance.json'), JSON.stringify(manifest));
            save(); assert.equal(loadPlans(directory, identity).length, 2);
            manifest.planner_sha = 'f'.repeat(40); save(); assert.throws(() => loadPlans(directory, identity), /planner_sha/);
            manifest.planner_sha = identity.planner_sha; plans[0].file = '../outside.json'; save(); assert.throws(() => loadPlans(directory, identity), /path/);
            plans[0].file = `${plans[0].suite}.json`; plans[0].sha256 = 'f'.repeat(64); save(); assert.throws(() => loadPlans(directory, identity), /digest/);
            manifest.plans = [plans[0]]; save(); assert.throws(() => loadPlans(directory, identity), /Missing enterprise/);
        } finally {rmSync(directory, {recursive: true, force: true});}
    });
    it('matches dot directories, root-level files and configured extensions without negation', () => {
        const matches = globMatcher('specs/**/*.{spec,test}.{ts,tsx,js,jsx,mjs,cjs,mts,cts}');
        for (const path of ['specs/root.spec.ts', 'specs/.hidden/a.test.mjs', 'specs/nested/test.spec.cts']) assert.equal(matches(path), true);
        assert.equal(matches('specs/helper.ts'), false);
        assert.equal(globMatcher('specs/visual/**')('specs/visual/test.spec.ts'), true);
        for (const pattern of ['!specs/**', '#specs/**', '../specs/**', '[abc].spec.ts']) assert.throws(() => globMatcher(pattern), /Unsupported/);
    });
});
