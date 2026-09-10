import test from 'node:test';
import assert from 'node:assert/strict';
import * as guardian from './triage-guardian.mjs';
import {mergeAttempts, reportTests, verifyClean} from './triage-harness.mjs';
import {checkSource} from './triage-policy.mjs';

const item = {repository: 'mattermost/mattermost', framework: 'playwright', name: 'playwright-full-enterprise-master', report_group_id: 'group', branch: 'master', commit_sha: 'a'.repeat(40), source_workflow_sha: 'b'.repeat(40), gh_run_id: '12', gh_run_attempt: '2', stable_key: 'MM-T1', file: 'specs/a.spec.ts', full_title: 'a.spec.ts > MM-T1 saves the message', project: 'chrome', image_digest: 'mattermost/server@sha256:' + 'c'.repeat(64)};
const message = 'Error: expect(locator).toHaveText(expected)\nExpected: saved\nReceived: pending';
const row = {id: 'case', report_id: 'report', suite_id: 'suite', stable_key: item.stable_key, file: item.file, full_title: item.full_title, project: item.project, status: 'failed', retry_count: 0, attempts: 1, attempts_failed: 1, run_failed: true, error_message: message};
const evidence = () => ({schema_version: 1, complete: true, truncated: false, trusted_source: true, source_workflow_sha: item.source_workflow_sha, source_workflow_ref: 'mattermost/mattermost/.github/workflows/e2e-tests-on-merge.yml@refs/heads/master', group: {...item, id: item.report_group_id, status: 'completed'}, reports: [{id: 'report', environment_metadata: {server_image_digest: item.image_digest}}], tests: [{...row}]});
const pw = (state = 'failed', error = message) => ({suites: [{title: 'a.spec.ts', file: 'a.spec.ts', specs: [{title: 'MM-T1 saves the message', file: 'a.spec.ts', tests: [{projectName: 'chrome', results: [{status: state, retry: 0, errors: state === 'passed' ? [] : [{message: error}]}]}]}]}]});

test('recorded failure matching uses exact queue selector, test identity and conservative error normalization', () => {
    const expected = guardian.recordedFailure(item, evidence());
    const baseline = reportTests('playwright', pw('failed', '\u001b[31m' + message.replaceAll('\n', '\r\n') + '\u001b[0m'), 'chrome', item.file);
    guardian.verifyReproduction(baseline, expected);
    for (const [state, error] of [['timedOut', 'Test timeout of 60000ms exceeded in beforeEach hook'], ['failed', 'Error: connect ECONNREFUSED localhost:8065'], ['failed', message.replace('pending', 'deleted')]]) {
        assert.throws(() => guardian.verifyReproduction(reportTests('playwright', pw(state, error), 'chrome', item.file), expected), /recorded failure/);
    }
});

test('missing, untrusted, wrong-run and ambiguous recorded failure evidence cannot authorize diagnosis', () => {
    assert.equal(typeof guardian.recordedFailure, 'function');
    const changes = [
        ev => { ev.complete = false; }, ev => { ev.truncated = true; }, ev => { ev.trusted_source = false; },
        ev => { ev.group.gh_run_attempt = '3'; }, ev => { ev.group.id = 'another-group'; }, ev => { ev.source_workflow_sha = 'd'.repeat(40); },
        ev => { ev.tests[0].file = 'specs/another.spec.ts'; }, ev => { ev.tests[0].project = 'firefox'; },
        ev => { ev.tests[0].error_message = null; }, ev => { ev.tests[0].status = 'passed'; },
        ev => { ev.tests[0].attempts = null; }, ev => { ev.tests[0].attempts_failed = null; }, ev => { ev.tests[0].run_failed = null; },
        ev => { ev.tests[0].retry_count = 1; }, ev => { ev.tests[0].attempts = 2; },
        ev => { ev.tests.push({...ev.tests[0]}); },
        ev => { ev.tests.push({...ev.tests[0], id: 'another-case', retry_count: 1, error_message: 'Different recorded failure'}); },
        ev => { ev.reports[0].environment_metadata.server_image_digest = 'mattermost/server@sha256:' + 'd'.repeat(64); },
    ];
    for (const mutate of changes) { const ev = evidence(); mutate(ev); assert.throws(() => guardian.recordedFailure(item, ev)); }
});

test('recorded retries are usable only as complete unambiguous attempt chains', () => {
    const ev = evidence();
    ev.tests[0] = {...row, attempts: 2, attempts_failed: 1, run_failed: false};
    ev.tests.push({...ev.tests[0], id: 'retry', retry_count: 1, status: 'passed', error_message: null});
    assert.equal(guardian.recordedFailure(item, ev).state, 'failed');
    ev.tests[1].attempts_failed = 0;
    assert.throws(() => guardian.recordedFailure(item, ev), /attempt/);
});

test('report parser rejects duplicate identities and wrong files even when all rows claim passes', () => {
    const duplicate = pw('passed'); duplicate.suites[0].specs.push(structuredClone(duplicate.suites[0].specs[0]));
    assert.throws(() => reportTests('playwright', duplicate, 'chrome', item.file), /identity|identities/);
    const wrongFile = pw('passed'); wrongFile.suites[0].specs[0].file = 'other.spec.ts';
    assert.throws(() => reportTests('playwright', wrongFile, 'chrome', item.file), /file|identity/);
    const wrongProject = pw('passed'); wrongProject.suites[0].specs[0].tests.push({...wrongProject.suites[0].specs[0].tests[0], projectName: 'firefox'});
    assert.throws(() => reportTests('playwright', wrongProject, 'chrome', item.file), /project|identity/);
});

test('clean verification compares file and project and refuses ambiguous original identities', () => {
    const failed = {title: item.full_title, file: 'e2e-tests/playwright/specs/a.spec.ts', project: 'chrome', state: 'failed', attempts: 1, retry: 0};
    const passed = {...failed, state: 'passed'};
    for (const change of [{file: 'e2e-tests/playwright/specs/other.spec.ts'}, {project: 'firefox'}]) {
        assert.throws(() => verifyClean([[passed], [passed], [{...passed, ...change}]], [failed], item.full_title, 3), /identit/);
    }
    assert.throws(() => verifyClean([[passed, passed], [passed, passed], [passed, passed]], [failed, failed], item.full_title, 3), /identit/);
});

test('a passing report cannot hide runner failure and runner infrastructure exits cannot reproduce a test failure', () => {
    assert.throws(() => reportTests('playwright', pw('passed'), 'chrome', item.file, 1), /exit|Runner/);
    assert.throws(() => reportTests('playwright', pw('failed'), 'chrome', item.file, 125), /exit|Runner/);
    assert.throws(() => reportTests('playwright', pw('failed'), 'chrome', item.file, null), /exit|Runner/);
    assert.throws(() => reportTests('playwright', pw('failed'), 'chrome', item.file, 0), /exit|Runner/);
    assert.equal(reportTests('playwright', pw('failed'), 'chrome', item.file, 1).length, 1);
});

test('Cypress sidecar cannot silently drop, repeat or substitute executed test identities', () => {
    const report = () => ({results: [{file: 'tests/integration/a_spec.js', tests: [{fullTitle: 'MM-T1 saves', state: 'passed', err: {}}]}]});
    const sidecar = () => ({tests: [{title: ['MM-T1 saves'], attempts: [{state: 'passed'}]}]});
    const extra = sidecar(); extra.tests.push({title: ['MM-T2 missing'], attempts: [{state: 'failed'}]});
    assert.throws(() => mergeAttempts(report(), extra), /identity|identities/);
    const duplicate = report(); duplicate.results[0].tests.push({...duplicate.results[0].tests[0]});
    assert.throws(() => mergeAttempts(duplicate, sidecar()), /identity|identities/);
    const valid = report(); mergeAttempts(valid, sidecar());
    const parsed = reportTests('cypress', valid, '', 'tests/integration/a_spec.js', 0);
    assert.equal(parsed[0].file, 'e2e-tests/cypress/tests/integration/a_spec.js');
    assert.throws(() => reportTests('cypress', valid, '', 'tests/integration/other_spec.js', 0), /file/);
});

test('Cypress uses the full spec path consistently with the original TSIO report parser', () => {
    const report = {results: [{file: 'a_spec.js', fullFile: 'tests/integration/channels/a_spec.js',
        tests: [{fullTitle: 'saves', state: 'passed', attempts: [{state: 'passed'}], err: {}}]}]};
    assert.equal(reportTests('cypress', report, '', 'tests/integration/channels/a_spec.js', 0)[0].file,
        'e2e-tests/cypress/tests/integration/channels/a_spec.js');
});

test('passed tests with errors and reproduction with extra errors remain unverified', () => {
    const report = pw('passed'); report.suites[0].specs[0].tests[0].results[0].errors.push({message: 'Unhandled error'});
    assert.throws(() => reportTests('playwright', report, 'chrome', item.file, 0), /error/);
    const baseline = reportTests('playwright', pw(), 'chrome', item.file, 1);
    baseline[0].errors.push({message: 'Additional setup error'});
    assert.throws(() => guardian.verifyReproduction(baseline, guardian.recordedFailure(item, evidence())), /recorded failure/);
});

const original = `test('MM-T1 saves', async ({page}) => { await page.getByRole('button', {name: 'Save'}).click(); await expect(page.getByText('Saved')).toBeVisible(); });`;
for (const [name, replacement] of [
    ['early return', original.replace('await page', 'return; await page')],
    ['false assertion guard', original.replace("await expect(page.getByText('Saved')).toBeVisible();", "if (false) { await expect(page.getByText('Saved')).toBeVisible(); }")],
    ['swallowed assertion failure', original.replace("await expect(page.getByText('Saved')).toBeVisible();", "try { await expect(page.getByText('Saved')).toBeVisible(); } catch (error) {}")],
    ['removed tested action', original.replace("await page.getByRole('button', {name: 'Save'}).click(); ", '')],
    ['unawaited assertion', original.replace('await expect(', 'expect(')],
    ['unawaited action', original.replace('await page.', 'page.')],
    ['matcher override', original + "\nexpect.extend({toBeVisible: () => ({pass: true, message: () => ''})});"],
    ['Cypress failure swallowing', original + "\nCypress.on('fail', () => false);"],
    ['mocked product response', original.replace('await page', "await page.route('**/save', route => route.fulfill({status: 200, body: 'saved'})); await page")],
]) test(`strict candidate policy rejects ${name} while retaining assertion text`, () => {
    assert.ok(checkSource(original, replacement, 'a.spec.ts', {strict: true}).errors.length > 0);
});

test('strict policy rejects moving an existing return ahead of the behavior', () => {
    const before = original.replace(' });', ' return; });');
    const after = before.replace(' return;', '').replace('await page', 'return; await page');
    assert.ok(checkSource(before, after, 'a.spec.ts', {strict: true}).errors.length > 0);
});

test('strict policy flags changing an existing flag that controls whether assertions execute', () => {
    const before = `const enabled = true; test('MM-T1', async () => { if (enabled) { expect(actual).toBe(expected); } });`;
    assert.ok(checkSource(before, before.replace('enabled = true', 'enabled = false'), 'a.spec.ts', {strict: true}).errors.length > 0);
});

test('strict policy rejects moving an assertion to another preserved test', () => {
    const assertion = "await expect(page.getByText('Saved')).toBeVisible();";
    const before = original + "\ntest('MM-T2 other', async ({page}) => {});";
    const after = before.replace(assertion, '').replace("async ({page}) => {}", `async ({page}) => {${assertion}}`);
    assert.ok(checkSource(before, after, 'a.spec.ts', {strict: true}).errors.length > 0);
});

test('strict policy accepts an added event-based wait within unchanged existing control flow', () => {
    const before = `test('MM-T1 saves', async ({page}) => { if (enabled) { await page.getByRole('button', {name: 'Save'}).click(); await expect(page.getByText('Saved')).toBeVisible(); } });`;
    const after = before.replace('await page', "await page.waitForResponse('**/save'); await page");
    assert.deepEqual(checkSource(before, after, 'a.spec.ts', {strict: true}).errors, []);
});
