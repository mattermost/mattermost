#!/usr/bin/env node
// Read-only compatibility replay of the two original stored Mattermost observations.
// This is offline validation, not a current-run artifact ingestion path.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {compareSuite, gitContext, hash} from './impact-gate-compare.mjs';

const args = process.argv.slice(2);
const options = {};
for (let i = 0; i < args.length; i += 2) {
    assert.ok(['--artifacts', '--checkout', '--config'].includes(args[i]) && args[i + 1] && !args[i + 1].startsWith('--'), 'Expected --artifacts DIR --checkout GIT_REPO --config PINNED_CONFIG');
    options[args[i].slice(2)] = resolve(args[i + 1]);
}
assert.ok(options.artifacts && options.checkout && options.config, 'Expected --artifacts DIR --checkout GIT_REPO --config PINNED_CONFIG');
const config = JSON.parse(readFileSync(options.config)).advisory;
const output = [];
for (const [name, runId] of [['pr-38356', '34168873085'], ['live-34174643457', '34174643457']]) {
    const directory = resolve(options.artifacts, name);
    const read = (file) => JSON.parse(readFileSync(resolve(directory, file)));
    const provenance = read('evidence/provenance.json');
    for (const source of provenance.sources) {
        assert.match(source.file, /^[\w.-]+\.json$/);
        const bytes = readFileSync(resolve(directory, 'evidence', source.file));
        assert.equal(bytes.length, source.bytes, `Captured length: ${source.file}`);
        assert.equal(hash(bytes), source.sha256, `Captured digest: ${source.file}`);
    }
    const run = read(`evidence/github-run-${runId}.json`);
    const identity = {repository: 'mattermost/mattermost', tested_sha: '5ed5f7d29ae67d6ecf7864022e37c66792280a45', base_sha: '502cf7e3e5379ce054bee24e279ec1779911aa38', workflow_sha: run.head_sha, run_id: runId, run_attempt: '1', planner_sha: '41657f86630a10ad048f0cf544cfdd109a1d3923'};
    assert.equal(String(run.id), runId);
    assert.equal(String(run.run_attempt), identity.run_attempt);
    assert.equal(run.repository.full_name, identity.repository);
    // Historical source object inspection is independent of the running
    // workflow checkout. Runtime always requires the trusted workflow HEAD.
    const context = gitContext(options.checkout, identity, false);
    const jobs = read('evidence/github-run-jobs.json');
    const suites = [];
    for (const framework of ['cypress', 'playwright']) {
        const suite = `${framework}-full-enterprise`;
        const plan = read(name === 'pr-38356' ? `${suite}.plan.json` : `plans/${suite}.json`);
        let retrospectiveAnnotation = false;
        if (name === 'pr-38356') {
            // Original plans were generated after the run and have no current-
            // run stamp. Add an explicit in-memory replay annotation only.
            assert.equal(plan.sourceRunId, undefined);
            plan.sourceRunId = `github:${identity.repository}:${runId}:1`;
            retrospectiveAnnotation = true;
        }
        const result = compareSuite({plan, evidence: read(`evidence/${suite}.evidence.json`), detail: read(`evidence/${suite}.report-detail.json`), orchestration: read(`evidence/${suite}.orchestration.json`)}, {config, identity, jobs, context});
        if (framework === 'cypress') {
            assert.equal(result.selection.total_static, 658);
            assert.equal(result.selection.total_dispatched, 447);
            assert.equal(result.observed_counts.final_failed_specs, 2);
            assert.equal(result.observed_failure_selection_recall.rate, name === 'pr-38356' ? 1 : null);
            assert.equal(result.workers.missing_worker_ids.length, name === 'pr-38356' ? 0 : 1);
        } else {
            assert.equal(result.selection.total_static, 291);
            assert.equal(result.selection.total_dispatched, 291);
            assert.equal(result.status, 'complete');
            assert.equal(result.observed_failure_selection_recall.total, 0);
            assert.equal(result.observed_failure_selection_recall.rate, null);
        }
        suites.push({retrospective_source_run_annotation: retrospectiveAnnotation, ...result});
    }
    output.push({capture: name, ...identity, suites});
}
process.stdout.write(JSON.stringify({kind: 'offline-stored-response-replay', captures: output, behavior_coverage: 'unavailable', live_dispatches: 0}, null, 2) + '\n');
