// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable @stylistic/dot-location, @stylistic/indent, @stylistic/multiline-ternary, @stylistic/operator-linebreak, @stylistic/wrap-regex, no-process-env -- Prettier owns formatting and the repo config relaxes these rules for .ts/.js only */

// Offline checks for the stage 0 session seed and resume, and for verifying an existing spec under a control: a fake
// infra stack (selftest_fake_infra.mjs) replaces Docker, the seed and the engine's replay. No network beyond loopback,
// no licence (a synthetic placeholder value is exported so the presence check passes).
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import {validateOutDir} from './lib/artifacts.mjs';
import {EXIT, hashFiles, listFiles, ORCH_DIR, readJson, REPO_ROOT, sha256File} from './lib/common.mjs';
import {loadControl} from './lib/verify/control_def.mjs';
import {checkVerifierResult} from './lib/verify/result_check.mjs';
import {resolveSpec, locateAssertion, testTitleOf} from './lib/verify/spec.mjs';
import {scrub, unsafeFindings} from './lib/verify/trace.mjs';

const PILOT = path.join(ORCH_DIR, 'pilot.mjs');
const FAKE = path.join(ORCH_DIR, 'selftest_fake_infra.mjs');
const SPEC = 'explorer-proto/sessions/bookmarks/generated/channels_bookmarks_bar_follows_switch.spec.ts';
const CONTROL = 'release-bookmark-title-changed';
const SHA_A = 'a'.repeat(64);

export async function verifySpecChecks({check, assert, newDir}) {
    function fakeInfra(extraEnv = {}) {
        const dir = newDir('fake-infra');
        const run = path.join(dir, '.run');
        const scripts = path.join(dir, 'scripts');
        fs.mkdirSync(run, {recursive: true});
        fs.mkdirSync(scripts, {recursive: true});
        const call = (cmd) => `#!/usr/bin/env bash\nexec node "${FAKE}" ${cmd} "$@"\n`;
        for (const cmd of ['gate', 'up', 'down']) {
            fs.writeFileSync(path.join(scripts, `${cmd}.sh`), call(cmd), {mode: 0o755});
        }
        fs.writeFileSync(
            path.join(scripts, 'bookmark_ctl.mjs'),
            `import {spawnSync} from 'node:child_process';\nconst r = spawnSync(process.execPath, ['${FAKE}', 'ctl', ...process.argv.slice(2)], {stdio: 'inherit'});\nprocess.exit(r.status ?? 1);\n`,
        );
        const env = {
            ...process.env,
            MM_LICENSE: 'synthetic-selftest-placeholder-value',
            PILOT_INFRA_DIR: dir,
            FAKE_RUN: run,
            PILOT_REPLAY_CMD: `node ${FAKE} replay`,
            PILOT_REPLAY_REPORT: path.join(dir, 'replay-report.json'),
            ...extraEnv,
        };
        const callsFile = path.join(run, 'calls.log');
        const calls = () => {
            return fs.existsSync(callsFile) ? fs.readFileSync(callsFile, 'utf8').trim().split('\n') : [];
        };
        return {dir, run, env, calls};
    }

    function pilot(args, env) {
        const r = spawnSync('node', [PILOT, ...args], {
            cwd: REPO_ROOT,
            encoding: 'utf8',
            env,
            maxBuffer: 64 * 1024 * 1024,
        });
        return {status: r.status, stdout: r.stdout, stderr: r.stderr};
    }

    function verifyArgs(out, id, extra = []) {
        return [
            'run',
            '--target',
            'release',
            '--live',
            '--agents=manual',
            '--verify-spec',
            SPEC,
            '--engine-charter',
            'session:bookmarks',
            '--control',
            CONTROL,
            '--run-id',
            id,
            '--out',
            out,
            ...extra,
        ];
    }

    const stage0Hashes = (out) => hashFiles(path.join(out, '0-target'), listFiles(path.join(out, '0-target')));
    const attemptHashes = (out, n) => {
        const dir = path.join(out, '0-target', `attempt-${n}`);
        return hashFiles(dir, listFiles(dir));
    };
    const stageResult = (out, dir) => readJson(path.join(out, dir, 'stage-record.json')).result;

    const shared = {};

    await check(
        'stage 0 passes the selected session to up.sh and verifies the manifest session and bookmark entries',
        () => {
            const fake = fakeInfra();
            const out = newDir('v-s0');
            const r = pilot(verifyArgs(out, 'selftest-s0', ['--to', 'target', '--keep-stack']), fake.env);
            assert(r.status === 0, `exit ${r.status}\n${r.stdout}\n${r.stderr}`);
            assert(
                fake.calls().includes('up session=bookmarks'),
                `up.sh was not given the session: ${fake.calls().join(',')}`,
            );
            const attempt = readJson(path.join(out, '0-target', 'attempt-1', 'attempt.json'));
            assert(
                attempt.outcome === 'pass' && attempt.reason === 'initial' && attempt.session === 'bookmarks',
                'attempt record',
            );
            const setup = readJson(path.join(out, '0-target', 'attempt-1', 'setup.json'));
            assert(
                setup.manifest_session_check.result === 'pass' &&
                    setup.manifest_session_check.session_name === 'bookmarks',
                'manifest check',
            );
            assert(/^[0-9a-f]{64}$/.test(setup.fixture_fingerprint), 'fixture fingerprint');
            assert(setup.licence === 'PASS' && setup.probe === 'pass', 'licence and probe');
            assert(!/127\.0\.0\.1|http:/.test(r.stdout + r.stderr), 'stage 0 printed an origin');
            const status = readJson(path.join(out, '0-target', 'status.json'));
            assert(status.attempts.length === 1 && status.current_attempt === 1, 'status lists the attempt');
            shared.fake = fake;
            shared.out = out;
        },
    );

    await check(
        'stage 0 fails when the seeded manifest lacks the session key (no advance, attempt recorded as fail)',
        () => {
            const fake = fakeInfra({FAKE_OMIT_SESSION: '1'});
            const out = newDir('v-s0-omit');
            const r = pilot(verifyArgs(out, 'selftest-omit', ['--to', 'target']), fake.env);
            assert(r.status === EXIT.FAIL, `expected exit 1, got ${r.status}`);
            assert(stageResult(out, '0-target') === 'fail', 'stage result');
            const attempt = readJson(path.join(out, '0-target', 'attempt-1', 'attempt.json'));
            assert(
                attempt.outcome === 'fail' && /session_name_missing_or_different/.test(attempt.detail),
                `attempt detail: ${attempt.detail}`,
            );
            const setup = readJson(path.join(out, '0-target', 'attempt-1', 'setup.json'));
            assert(
                setup.manifest_session_check.result === 'fail' && setup.fixture_fingerprint === null,
                'setup records the failed check',
            );
            assert(
                !fs.existsSync(path.join(out, '1-baseline', 'baseline.json')),
                'the run advanced past a failed stage 0',
            );
        },
    );

    await check(
        'resume reuses a valid stage 0: artifact hashes unchanged, nothing re-run, session and fingerprint intact',
        () => {
            const {fake, out} = shared;
            const before = stage0Hashes(out);
            const callsBefore = fake.calls();
            const fingerprint = readJson(path.join(out, '0-target', 'attempt-1', 'setup.json')).fixture_fingerprint;
            const r = pilot(
                ['run', '--resume', '--run-id', 'selftest-s0', '--out', out, '--to', 'target', '--keep-stack'],
                fake.env,
            );
            assert(r.status === 0, `exit ${r.status}\n${r.stdout}\n${r.stderr}`);
            assert(/0-target\s+reused/.test(r.stdout), `stage 0 was not reused:\n${r.stdout}`);
            assert(JSON.stringify(stage0Hashes(out)) === JSON.stringify(before), 'stage-0 artifacts changed on resume');
            assert(JSON.stringify(fake.calls()) === JSON.stringify(callsBefore), 'an infra script ran on resume');
            const manifest = readJson(path.join(fake.run, 'seed-manifest.json'));
            assert(manifest.session?.name === 'bookmarks', 'manifest lost its session key');
            assert(
                readJson(path.join(out, '0-target', 'attempt-1', 'setup.json')).fixture_fingerprint === fingerprint,
                'fingerprint',
            );
        },
    );

    await check('a failed probe starts attempt-2 under the same run and leaves attempt-1 byte for byte', () => {
        const {fake, out} = shared;
        const first = attemptHashes(out, 1);
        const statePath = path.join(fake.run, 'state.json');
        const state = readJson(statePath);
        state.bookmarks['release-planning'].title = 'Changed behind the orchestrator';
        fs.writeFileSync(statePath, JSON.stringify(state));
        const r = pilot(['run', '--resume', '--out', out, '--to', 'target', '--keep-stack'], fake.env);
        assert(r.status === 0, `exit ${r.status}\n${r.stdout}\n${r.stderr}`);
        assert(JSON.stringify(attemptHashes(out, 1)) === JSON.stringify(first), 'attempt-1 changed');
        const status = readJson(path.join(out, '0-target', 'status.json'));
        assert(status.attempts.length === 2 && status.current_attempt === 2, 'attempts list');
        assert(status.attempts[0].outcome === 'pass' && status.attempts[1].outcome === 'pass', 'attempt outcomes');
        assert(/^probe_failed:/.test(status.attempts[1].reason), `attempt-2 reason: ${status.attempts[1].reason}`);
        const a = readJson(path.join(out, '0-target', 'attempt-1', 'setup.json')).fixture_fingerprint;
        const b = readJson(path.join(out, '0-target', 'attempt-2', 'setup.json')).fixture_fingerprint;
        assert(a !== b, 'a new stack must give a new fingerprint');
        const {failures} = validateOutDir(out);
        assert(failures.length === 0, `artifact validation: ${JSON.stringify(failures)}`);
        pilot(['run', '--resume', '--out', out, '--to', 'target'], fake.env);
    });

    const flow = {};
    await check(
        'verify an existing spec: S0 resume, S1 baseline, S2 control with restore, S3 dispatch (exit 20) and teardown',
        () => {
            const fake = fakeInfra();
            const out = newDir('v-flow');
            const first = pilot(verifyArgs(out, 'selftest-flow', ['--to', 'target', '--keep-stack']), fake.env);
            assert(first.status === 0, `S0 exit ${first.status}\n${first.stdout}\n${first.stderr}`);
            const s0 = stage0Hashes(out);
            const second = pilot(['run', '--resume', '--run-id', 'selftest-flow', '--out', out], fake.env);
            assert(
                second.status === EXIT.AWAITING_AGENT,
                `expected exit 20, got ${second.status}\n${second.stdout}\n${second.stderr}`,
            );
            assert(/0-target\s+reused/.test(second.stdout), 'resume did not reuse stage 0');
            assert(JSON.stringify(stage0Hashes(out)) === JSON.stringify(s0), 'stage-0 artifacts changed');
            for (const dir of ['1-baseline', '2-control', 'verify']) {
                assert(stageResult(out, dir) === 'pass', `${dir} ${stageResult(out, dir)}`);
            }
            const baseline = readJson(path.join(out, '1-baseline', 'baseline.json'));
            assert(
                baseline.judge.status === 'pass' && baseline.replay.exit_code === 0 && baseline.replay.workers === 1,
                'baseline',
            );
            const control = readJson(path.join(out, '2-control', 'control.json'));
            assert(control.result === 'pass' && control.judge.observed === 'control-fail', 'control judge');
            assert(control.expectation.failing_line === 45, `failing line ${control.expectation.failing_line}`);
            assert(
                control.restore.seed_check.result === 'pass' && control.restore.replay.judge.status === 'pass',
                'restore',
            );
            assert(control.label === 'verification control', 'control label');
            assert(
                control.mutation_control.states.map((s) => s.state).join() ===
                    'precondition,mutate,verify_mutation,run_spec,judge,restore,verify_restore',
                'control states',
            );
            const traceText = fs.readFileSync(path.join(out, '2-control', 'failure-trace.json'), 'utf8');
            assert(unsafeFindings(traceText).length === 0, 'the failure trace is not clean');
            const trace = JSON.parse(traceText);
            assert(
                trace.bookmark_bar_snapshot.length >= 3 && trace.bookmark_bar_snapshot.every((l) => !/url/.test(l)),
                'bar snapshot',
            );
            assert(!/^\s*(?:>\s*)?\d+ \|/m.test(trace.message), 'the code frame must not be part of the trace message');
            const task = readJson(path.join(out, 'verify', 'agent-task.json'));
            assert(
                task.role === 'independent-verifier' &&
                    task.context.spec.sha256 === sha256File(path.join(REPO_ROOT, SPEC)),
                'task',
            );
            assert(
                task.context.assertion.expected_failing_line === 45 && task.context.assertion.expected_step_count === 8,
                'task assertion',
            );
            const dispatch = readJson(path.join(out, 'verify', 'dispatch.json'));
            assert(
                dispatch.teardown.confirmed === true && fake.calls().at(-1) === 'down',
                'teardown was not recorded and confirmed',
            );
            assert(!fs.existsSync(path.join(fake.run, 'seed-manifest.json')), 'the stack is still up after dispatch');
            assert(!fs.existsSync(path.join(out, 'summary.json')), 'a summary was written before collection');
            const {failures} = validateOutDir(out);
            assert(failures.length === 0, `artifact validation: ${JSON.stringify(failures)}`);
            flow.out = out;
            flow.fake = fake;
            flow.task = task;
            flow.control = control;
            flow.trace = trace;
        },
    );

    const validResult = (patch = {}) => {
        const {task, control, trace} = flow;
        return {
            task_id: task.task_id,
            spec_sha256_observed: task.context.spec.sha256,
            clean_fixture_confirmed: true,
            baseline_pass: {exit: 0, passed: true, judge: 'pass'},
            control_applied: {accepted: true, fields_changed_summary: 'display_name only'},
            reproduced_failure: {
                failing_line: control.expectation.failing_line,
                expect_call: control.expectation.expected_failing_assertion_text,
                message_first_line: trace.message_first_line,
                only_one_error: true,
                step_evidence_summary: Array.from(
                    {length: control.expectation.expects_up_to_failing},
                    (_, i) => `expect ${i + 1}`,
                ),
                judge: 'pass',
            },
            restored: {
                readback: true,
                id_same: true,
                seed_check: true,
                replay_pass: true,
                judge: 'pass',
                spec_sha_after: task.context.spec.sha256,
            },
            verdict: 'pass',
            notes: 'selftest',
            ...patch,
        };
    };
    const collect = (result, label) => {
        const out = newDir(label);
        fs.cpSync(flow.out, out, {recursive: true});
        fs.writeFileSync(path.join(out, 'verify', 'agent-result.json'), JSON.stringify(result, null, 2));
        const r = pilot(['run', '--resume', '--out', out], flow.fake.env);
        return {...r, out};
    };

    await check(
        'collect: a consistent verifier result is validated against the records and the summary is written',
        () => {
            const r = collect(validResult(), 'v-collect');
            assert(r.status === 0, `exit ${r.status}\n${r.stdout}\n${r.stderr}`);
            assert(
                !/0-target\s+(?:pass|fail)/.test(r.stdout) && /0-target\s+reused/.test(r.stdout),
                'stage 0 must not start a stack after dispatch',
            );
            const summary = readJson(path.join(r.out, 'summary.json'));
            assert(summary.verdict === 'pass' && summary.spec.unchanged_at_every_stage === true, 'summary verdict');
            assert(
                summary.results.map((x) => `${x.step}:${x.status}`).join() ===
                    'original_pass:verified,controlled_failure:verified,independent_reproduction:verified,restored_pass:verified',
                JSON.stringify(summary.results),
            );
            assert(summary.verification_control.label === 'verification control', 'control label');
            assert(summary.stages.find((s) => s.dir === '0-target').attempts.length === 1, 'attempts list');
            assert(
                fs.readFileSync(path.join(r.out, 'summary.md'), 'utf8').includes('verification control'),
                'summary.md',
            );
            assert(flow.fake.calls().filter((c) => c === 'down').length === 1, 'collect ran down.sh again');
            const {failures} = validateOutDir(r.out);
            assert(failures.length === 0, `artifact validation: ${JSON.stringify(failures)}`);
        },
    );

    const rejectedCases = () => [
        [
            'a pass whose failing line differs from the orchestrator record',
            {reproduced_failure: {...validResult().reproduced_failure, failing_line: 46}},
        ],
        [
            'a pass whose failing expect call differs',
            {
                reproduced_failure: {
                    ...validResult().reproduced_failure,
                    expect_call: "await expect(page).toHaveURL('x')",
                },
            },
        ],
        [
            'a pass with more than one error',
            {reproduced_failure: {...validResult().reproduced_failure, only_one_error: false}},
        ],
        ['a pass whose restored replay failed', {restored: {...validResult().restored, replay_pass: false}}],
        ['a pass with a fixture that was not confirmed clean', {clean_fixture_confirmed: false}],
        [
            'a pass with too few expects in the step evidence',
            {reproduced_failure: {...validResult().reproduced_failure, step_evidence_summary: ['one']}},
        ],
        ['a fail verdict over fields that all show success', {verdict: 'fail'}],
        ['a result for a different task', {task_id: 'collect-foreign-0000000000'}],
        ['a result with an origin in its text', {notes: 'seen at http://127.0.0.1:8065/x'}],
    ];
    await check(
        'collect rejects verifier results that contradict the orchestrator records (exit 21, set aside)',
        () => {
            for (const [name, patch] of rejectedCases()) {
                const r = collect(validResult(patch), 'v-reject');
                assert(r.status === EXIT.AGENT_INVALID, `${name}: expected exit 21, got ${r.status}\n${r.stdout}`);
                assert(
                    fs.existsSync(path.join(r.out, 'collect', 'agent-result.rejected.json')),
                    `${name}: result not set aside`,
                );
                assert(
                    !fs.existsSync(path.join(r.out, 'verify', 'agent-result.json')),
                    `${name}: result left in place`,
                );
                const errors = readJson(path.join(r.out, 'collect', 'agent-result.errors.json')).errors.join('\n');
                assert(!/127\.0\.0\.1|8065/.test(errors), `${name}: error lines echo instance data`);
                assert(
                    !fs.existsSync(path.join(r.out, 'summary.json')),
                    `${name}: summary written for a rejected result`,
                );
            }
        },
    );

    await check(
        'collect: an honest fail verdict is accepted as a failed run; a different spec hash is a hard failure',
        () => {
            const honest = collect(
                validResult({
                    verdict: 'fail',
                    reproduced_failure: {...validResult().reproduced_failure, failing_line: 46, judge: 'fail'},
                }),
                'v-honest-fail',
            );
            assert(honest.status === EXIT.FAIL, `honest fail: exit ${honest.status}\n${honest.stdout}`);
            const summary = readJson(path.join(honest.out, 'summary.json'));
            assert(
                summary.results.find((x) => x.step === 'independent_reproduction').status === 'failed',
                'independent row',
            );
            assert(summary.verdict === 'fail', 'summary verdict');
            const other = collect(validResult({spec_sha256_observed: SHA_A}), 'v-sha');
            assert(other.status === EXIT.FAIL, `sha mismatch: exit ${other.status}\n${other.stdout}`);
            const sha = readJson(path.join(other.out, 'collect', 'collect.json'));
            assert(sha.hard_failure === 'spec_hash_mismatch' && sha.run_verdict === 'fail', 'hard failure record');
            assert(
                readJson(path.join(other.out, 'summary.json')).spec.unchanged_at_every_stage === false,
                'unchanged flag',
            );
        },
    );

    await check('a spec hash that differs from the recorded one stops the run before any stage (hard failure)', () => {
        const out = newDir('v-spec-hash');
        fs.cpSync(flow.out, out, {recursive: true});
        const run = readJson(path.join(out, 'run.json'));
        run.verify_spec.sha256 = SHA_A;
        run.inputs_fingerprint = SHA_A;
        fs.writeFileSync(path.join(out, 'run.json'), JSON.stringify(run));
        const before = hashFiles(out, listFiles(out, {skip: (rel) => rel === 'run.json' || rel.startsWith('.state')}));
        const r = pilot(['run', '--resume', '--out', out], flow.fake.env);
        assert(r.status === EXIT.FAIL && /spec_hash_mismatch/.test(r.stdout), `exit ${r.status}\n${r.stdout}`);
        const after = hashFiles(out, listFiles(out, {skip: (rel) => rel === 'run.json' || rel.startsWith('.state')}));
        assert(JSON.stringify(before) === JSON.stringify(after), 'a stage ran after the spec hash mismatch');
        const reuse = pilot(
            verifyArgs(newDir('v-reuse-id'), 'selftest-flow').slice(0, -2).concat(['--out', out]),
            flow.fake.env,
        );
        assert(
            reuse.status === EXIT.USAGE,
            `an existing run id with different inputs must be refused, got ${reuse.status}`,
        );
    });

    await check(
        'the committed spec is addressed by path and sha256; spec, control and assertion are read, not hard-coded',
        () => {
            const spec = resolveSpec(SPEC, 'bookmarks');
            assert(spec.sha256 === sha256File(path.join(REPO_ROOT, SPEC)), 'spec hash');
            for (const bad of [
                '../x.spec.ts',
                '/etc/x.spec.ts',
                'explorer-proto/generated/pilot_01_mx_05.spec.ts',
                'explorer-proto/sessions/bookmarks/charter.json',
            ]) {
                let threw = false;
                try {
                    resolveSpec(bad, 'bookmarks');
                } catch {
                    threw = true;
                }
                assert(threw, `resolveSpec accepted ${bad}`);
            }
            const control = loadControl(CONTROL, 'bookmarks');
            const text = fs.readFileSync(path.join(REPO_ROOT, SPEC), 'utf8');
            const located = locateAssertion(text, control.entry.expected_failing_assertion);
            assert(
                located.line === 45 && located.matcher === 'toBeVisible' && located.expects_up_to_failing.length === 8,
                JSON.stringify(located),
            );
            assert(located.call.includes("name: 'Release brief echo 5b90'"), 'located call');
            assert(testTitleOf(text).startsWith('channels.bookmarks:bar-follows-switch'), 'test title');
            assert(
                control.declaredTitle === 'Release brief echo 5b90' &&
                    control.def.changed_title === 'Release memo golf 3e47',
                'titles',
            );
        },
    );

    await check(
        'trace scrubbing removes origins, ports, ids, slugs and tokens; verifier result checks hold on synthetic data',
        () => {
            const dirty = `Page http://127.0.0.1:8065/qa-team/channels/release-planning id abcdefghij0123456789klmnop Bearer abc.def at ${REPO_ROOT}/x qa-sandbox`;
            const clean = scrub(dirty);
            assert(unsafeFindings(clean).length === 0, `scrub left: ${clean}`);
            assert(unsafeFindings(dirty).length >= 3, 'the scan missed unsafe text');
            const task = {task_id: 'collect-x'};
            const record = {
                spec_sha256: SHA_A,
                failing_line: 45,
                expect_call: 'await expect(a).toBeVisible();',
                message_first_line: 'expect(locator).toBeVisible() failed',
                expects_up_to_failing: 2,
            };
            const base = {
                task_id: 'collect-x',
                spec_sha256_observed: SHA_A,
                clean_fixture_confirmed: true,
                baseline_pass: {exit: 0, passed: true, judge: 'pass'},
                control_applied: {accepted: true, fields_changed_summary: 'x'},
                reproduced_failure: {
                    failing_line: 45,
                    expect_call: 'expect(a).toBeVisible()',
                    message_first_line: 'Error: expect(locator).toBeVisible() failed',
                    only_one_error: true,
                    step_evidence_summary: ['a', 'b'],
                    judge: 'pass',
                },
                restored: {
                    readback: true,
                    id_same: true,
                    seed_check: true,
                    replay_pass: true,
                    judge: 'pass',
                    spec_sha_after: SHA_A,
                },
                verdict: 'pass',
                notes: '',
            };
            const run = (patch) =>
                checkVerifierResult({result: {...base, ...patch}, task, record, text: JSON.stringify(base)});
            assert(run({}).errors.length === 0, `a consistent result was refused: ${run({}).errors}`);
            assert(
                run({baseline_pass: {exit: 1, passed: false, judge: 'fail'}}).errors.some((e) => /contradicts/.test(e)),
                'pass over a failed baseline',
            );
            assert(
                run({restored: {...base.restored, id_same: false}}).errors.length > 0,
                'pass over a changed bookmark id',
            );
            assert(
                run({
                    verdict: 'blocked',
                    baseline_pass: null,
                    control_applied: null,
                    reproduced_failure: null,
                    restored: null,
                }).errors.length === 0,
                'a blocked result may carry nulls',
            );
            assert(run({baseline_pass: null}).errors.length > 0, 'nulls are only for blocked');
            assert(
                run({spec_sha256_observed: 'b'.repeat(64)}).hardFailure === 'spec_hash_mismatch',
                'spec hash mismatch',
            );
            assert(run({unexpected: 1}).errors.length > 0, 'unknown fields are refused');
        },
    );
}
