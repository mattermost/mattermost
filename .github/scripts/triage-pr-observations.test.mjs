import test from 'node:test';
import assert from 'node:assert/strict';
import {legacyObservations} from './triage-pr-observations.mjs';

// Minimal actual production shapes from PR 38407, run 34258829836/1.
const commit = 'b16a0017c46938575e359e3b4ca21da84fe212ce';
const path = 'tests/integration/channels/channel_sidebar/drag_and_drop_spec.ts';
const title = 'Channel sidebar should move category to correct place';
const error = 'AssertionError: Timed out retrying after 30000ms: Expected to find element: `.SidebarChannelGroupHeader_groupButton > div[data-rbd-drag-handle-draggable-id]`, but never found it.';
const at = ['2026-09-08T18:01:12.083304Z', '2026-09-08T18:03:03.238349Z'];
const row = (status = 'failed', retry_count = 0) => ({title: 'should move category to correct place', full_title: title,
    status, ordinal: retry_count, retry_count, ...(status === 'failed' ? {error_message: error, error_stack: `${error}\n    at Context.eval (webpack://cypress/./${path}:69:98)`} : {})});
function fixture() {
    const c = {latest_commit_sha: commit, latest_run_attempt: 1, contributing_reports: ['01a08221-ffbe-75cf-b0cc-844d55f44a9d'],
        filters: {repository: 'mattermost/mattermost', commit_sha: commit, target_name: 'cypress-full-enterprise'},
        specs: [{full_title: 'Channel sidebar › should move category to correct place', status: 'failed',
            history: [{report_id: '01a08230-4ec7-79bd-b743-800f59634354', commit_sha: commit, run_attempt: 1, status: 'failed', error_message: error}]}]};
    const attempts = at.map((reported_at, i) => ({id: `execution-${i}`, spec_path: path, reported_at, gh_job_id: ['102172697746', '102172697793'][i],
        gh_job_name: ['e2e-cypress / cypress-full / dispatch-run-9', 'e2e-cypress / cypress-full / dispatch-run-17'][i],
        expired: false, late_report: false, status: 'failed', error_message: error, test_cases: [row()]}));
    const o = {repository: 'mattermost/mattermost', commit_sha: commit, gh_run_id: '34258829836', gh_run_attempt: '1',
        name: 'cypress-full-enterprise', framework: 'cypress', branch: 'pr-38407', gh_pr_number: 38407,
        run_id: '01a08221-ffa8-791a-9624-3856cd73d525', status: 'completed', total_units: 1,
        counts: {pending: 0, leased: 0, abandoned: 0, retest_eligible: 0, completed_pass: 0, completed_fail: 1, completed_skipped: 0},
        units: [{id: '01a08221-ffba-74e7-9bfd-8063de32d351', spec_path: path, state: 'completed_fail', outcome_set_at: at[1], attempts}]};
    return {c, o};
}

function passUnit(o) {
    o.units[0].state = 'completed_pass';
    o.units[0].attempts.at(-1).status = 'passed';
    o.counts.completed_fail = 0; o.counts.completed_pass = 1;
}

test('production Cypress final failure retains both executions, exact identities and original errors', () => {
    const {c, o} = fixture(); const original = JSON.stringify({c, o});
    const result = legacyObservations(c, o);
    assert.equal(result.tests.length, 1);
    const observed = result.tests[0];
    assert.equal(observed.observation, 'final_failure');
    assert.equal(observed.file, path); assert.equal(observed.full_title, title);
    assert.equal(observed.project, null); assert.equal(observed.stable_key, null);
    assert.equal(observed.rows.length, 2);
    assert.deepEqual(observed.rows.map(r => r.error_message), [error, error]);
    assert.deepEqual(observed.rows.map(r => r.execution.gh_job_id), ['102172697746', '102172697793']);
    assert.deepEqual(observed.rows.map(r => r.retry_count), [0, 0]);
    assert.equal(result.group.commit_sha, commit);
    assert.equal(result.group.gh_run_id, '34258829836');
    assert.equal(result.group.gh_run_attempt, '1');
    assert.equal(result.group.id, c.contributing_reports[0]);
    assert.notEqual(result.group.id, o.run_id);
    assert.equal(result.group.source_workflow_sha, undefined);
    assert.equal(result.complete, false);
    assert.ok(result.reasons.includes('legacy_worker_report_completeness_unverified'));
    assert.equal(JSON.stringify({c, o}), original);
});

test('actual Playwright internal failed/pass retry rows describe a survivor, not a final failure', () => {
    const {c, o} = fixture(); passUnit(o);
    o.framework = 'playwright'; o.name = c.filters.target_name = 'playwright-full-enterprise';
    const spec = 'specs/functional/channels/burn_on_read/sender_flow.spec.ts';
    o.units[0].spec_path = spec;
    o.units[0].attempts = [{...o.units[0].attempts[1], spec_path: spec, status: 'flaky', test_cases: [
        {...row(), full_title: 'functional/channels/burn_on_read/sender_flow.spec.ts > Burn-on-Read Sender Flow > MM-66742_15 sends BoR message and views sent status with recipient count'},
        {...row('passed', 1), full_title: 'functional/channels/burn_on_read/sender_flow.spec.ts > Burn-on-Read Sender Flow > MM-66742_15 sends BoR message and views sent status with recipient count'},
    ]}];
    const result = legacyObservations(c, o);
    assert.equal(result.tests.length, 1); assert.equal(result.tests[0].observation, 'retry_survivor');
    assert.deepEqual(result.tests[0].rows.map(r => r.status), ['failed', 'passed']);
    assert.equal(result.tests[0].stable_key, null, 'do not invent a stable key from an MM ID in a title');
    assert.ok(result.reasons.includes('legacy_playwright_project_unavailable'));
});

test('a whole-spec retest survivor preserves failed and passing executions', () => {
    const {c, o} = fixture(); passUnit(o); o.units[0].attempts[1].test_cases = [row('passed')];
    const result = legacyObservations(c, o);
    assert.equal(result.tests[0].observation, 'retry_survivor');
    assert.deepEqual(result.tests[0].rows.map(r => r.status), ['failed', 'passed']);
});

test('final execution is bound by outcome timestamp, not attempts array order', () => {
    const {c, o} = fixture();
    o.units[0].attempts[0].status = 'passed'; o.units[0].attempts[0].test_cases = [row('passed')];
    o.units[0].attempts.reverse();
    assert.equal(legacyObservations(c, o).tests[0].observation, 'final_failure');
});

test('equal global titles in different spec files stay separate', () => {
    const {c, o} = fixture(); const other = structuredClone(o.units[0]);
    other.id = 'other-unit'; other.spec_path = 'tests/integration/channels/other_spec.ts';
    for (const a of other.attempts) { a.id += '-other'; a.spec_path = other.spec_path; }
    o.units.push(other); o.total_units = 2; o.counts.completed_fail = 2;
    const result = legacyObservations(c, o);
    assert.equal(result.tests.length, 2); assert.notEqual(result.tests[0].file, result.tests[1].file);
});

test('duplicate same-title retry zero rows cannot be called a retry survivor', () => {
    const {c, o} = fixture(); passUnit(o);
    o.units[0].attempts[1].test_cases = [row(), row('passed', 0)];
    const result = legacyObservations(c, o);
    assert.ok(result.tests.every(t => t.observation === 'legacy_attempts_unknown'));
    assert.ok(result.reasons.includes('legacy_test_final_outcome_unresolved'));
});

test('ambiguous earlier same-title tests are not joined to a later pass', () => {
    const {c, o} = fixture(); passUnit(o);
    o.units[0].attempts[0].test_cases.push(row()); o.units[0].attempts[1].test_cases = [row('passed')];
    assert.equal(legacyObservations(c, o).tests[0].observation, 'legacy_attempts_unknown');
});

test('a renamed title in a later pass does not rescue a different failed identity', () => {
    const {c, o} = fixture(); passUnit(o);
    o.units[0].attempts[1].test_cases = [{...row('passed'), full_title: 'some different test'}];
    assert.equal(legacyObservations(c, o).tests[0].observation, 'legacy_attempts_unknown');
});

for (const [name, mutate] of [
    ['missing final timestamp', o => { delete o.units[0].outcome_set_at; }],
    ['malformed matching final timestamp', o => { o.units[0].outcome_set_at = o.units[0].attempts[1].reported_at = 'invalid'; }],
    ['two matching final executions', o => { o.units[0].attempts[0].reported_at = at[1]; }],
    ['late execution', o => { o.units[0].attempts[1].late_report = true; }],
    ['expired execution', o => { o.units[0].attempts[1].expired = true; }],
    ['missing job ID', o => { delete o.units[0].attempts[1].gh_job_id; }],
    ['wrong execution file', o => { o.units[0].attempts[1].spec_path = 'other.ts'; }],
    ['duplicate execution ID', o => { o.units[0].attempts[1].id = o.units[0].attempts[0].id; }],
    ['run still in progress', o => { o.status = 'in_progress'; }],
]) test(`${name} remains explicitly uncertain`, () => {
    const {c, o} = fixture(); mutate(o); const result = legacyObservations(c, o);
    assert.equal(result.complete, false); assert.ok(result.reasons.length > 1);
    assert.ok(result.tests.every(t => t.observation === 'legacy_attempts_unknown'));
});

test('missing final test cases preserves the failed unit as unresolved evidence', () => {
    const {c, o} = fixture(); o.units[0].attempts[1].test_cases = [];
    const result = legacyObservations(c, o);
    assert.ok(result.reasons.includes('legacy_failed_unit_without_final_failed_case'));
    assert.ok(result.tests.some(t => t.full_title === null && t.rows[1].error_message === error));
});

test('flaky execution without its failed case row remains visible and unresolved', () => {
    const {c, o} = fixture(); passUnit(o);
    o.units[0].attempts = [{...o.units[0].attempts[1], status: 'flaky', test_cases: [row('passed', 1)]}];
    const result = legacyObservations(c, o);
    assert.ok(result.reasons.includes('legacy_failed_execution_without_failed_case'));
    assert.equal(result.tests[0].observation, 'legacy_attempts_unknown');
    assert.equal(result.tests[0].rows[0].error_message, error);
});

test('conflicting stored stable keys cannot be joined solely by title', () => {
    const {c, o} = fixture(); passUnit(o);
    o.units[0].attempts[0].test_cases[0].stable_key = 'one';
    o.units[0].attempts[1].test_cases = [{...row('passed'), stable_key: 'two'}];
    const result = legacyObservations(c, o);
    assert.equal(result.tests[0].observation, 'legacy_attempts_unknown');
    assert.equal(result.tests[0].stable_key, null);
});

test('mismatched consolidated identity cannot supply a report group ID', () => {
    const {c, o} = fixture(); c.latest_commit_sha = 'a'.repeat(40);
    const result = legacyObservations(c, o);
    assert.equal(result.group.commit_sha, commit); assert.equal(result.group.id, undefined);
    assert.ok(result.reasons.includes('legacy_consolidated_identity_unverified'));
    assert.ok(result.reasons.includes('legacy_report_group_id_unavailable'));
});

test('missing orchestration preserves consolidated history without guessing a file or identity', () => {
    const {c} = fixture(); const result = legacyObservations(c, null);
    assert.equal(result.group, null); assert.equal(result.complete, false);
    assert.equal(result.tests[0].file, null); assert.equal(result.tests[0].observation, 'legacy_attempts_unknown');
    assert.deepEqual(result.tests[0].rows[0].history, c.specs[0].history);
});

test('incomplete dispatch counts and units are disclosed independently from observed failures', () => {
    const {c, o} = fixture(); o.total_units = 2; o.counts.pending = 1;
    const result = legacyObservations(c, o);
    assert.equal(result.complete, false); assert.equal(result.tests[0].observation, 'final_failure');
    assert.ok(result.reasons.includes('legacy_dispatch_coverage_incomplete'));
    assert.ok(result.reasons.includes('legacy_dispatch_counts_inconsistent'));
});

test('passing reports with no observed failure still do not establish worker completeness', () => {
    const {c, o} = fixture(); passUnit(o);
    for (const a of o.units[0].attempts) { a.status = 'passed'; a.test_cases = [row('passed')]; }
    const result = legacyObservations(c, o);
    assert.deepEqual(result.tests, []); assert.equal(result.complete, false);
});

test('malformed legacy JSON yields explicit limits instead of a fabricated clean outcome', () => {
    for (const [c, o] of [[null, null], [{specs: [null, {history: [null]}]}, null], [[], {}]]) {
        const result = legacyObservations(c, o);
        assert.equal(result.complete, false); assert.ok(result.reasons.includes('legacy_orchestration_identity_unavailable'));
    }
});
