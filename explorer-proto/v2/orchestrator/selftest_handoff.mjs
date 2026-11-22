// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable @stylistic/indent, @stylistic/multiline-ternary, @stylistic/operator-linebreak, @stylistic/wrap-regex, no-process-env -- Prettier owns formatting and the repo config relaxes these rules for .ts/.js only */

// Offline checks for the byte-exact handoff to the deterministic verifier process, interruption and resume, the lost
// fixture recovery and the headless CI entry. The fake infra stack stands in for Docker; the verifier under test is the
// real verifier script running as a separate process.
import {spawnSync} from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import {validateOutDir} from './lib/artifacts.mjs';
import {EXIT, hashFiles, listFiles, ORCH_DIR, readJson, REPO_ROOT, sha256File} from './lib/common.mjs';
import {parseImage} from './lib/image.mjs';
import {validate} from './lib/schemas.mjs';
import {portableArgv, scrubbedEnv, thawTree, verifierArgv} from './lib/verify/handoff.mjs';
import {unsafeFindings} from './lib/verify/trace.mjs';
import {FAKE, LICENCE_PLACEHOLDER, createSupport} from './selftest_support.mjs';

const VERIFIER = path.join(ORCH_DIR, 'verifier', 'bookmarks_verifier.mjs');
const DIGEST = `sha256:${'a'.repeat(64)}`;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function handoffChecks({check, assert, newDir}) {
    const {fakeInfra, pilot, pilotAsync, verifyArgs} = createSupport({newDir});
    const processArgs = (out, id, extra = []) => verifyArgs(out, id, ['--verifier=process', ...extra]);
    const json = (...parts) => readJson(path.join(...parts));
    const stage0Hashes = (out) => hashFiles(path.join(out, '0-target'), listFiles(path.join(out, '0-target')));
    const attemptHashes = (out, n) => {
        const dir = path.join(out, '0-target', `attempt-${n}`);
        return hashFiles(dir, listFiles(dir));
    };
    const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
    const flow = {};

    await check(
        'process delivery end to end: byte-exact dispatch record, nonce inside the task, frozen inputs, separate verifier process, bound receipt, summary',
        () => {
            const fake = fakeInfra({ORCH_SECRET_SENTINEL: '1'});
            const out = newDir('h-flow');
            const r = pilot(processArgs(out, 'selftest-h1'), fake.env);
            assert(r.status === 0, `exit ${r.status}\n${r.stdout}\n${r.stderr}`);
            const taskFile = path.join(out, 'verify', 'agent-task.json');
            const traceFile = path.join(out, '2-control', 'failure-trace.json');
            const dispatch = json(out, 'verify', 'dispatch.json');
            const d = dispatch.delivery;
            assert(d.mode === 'process: same worker, artifact paths', 'delivery mode');
            assert(d.task_sha256 === sha256File(taskFile), 'recorded task hash differs from the bytes on disk');
            assert(d.trace_sha256 === sha256File(traceFile), 'recorded trace hash differs from the bytes on disk');
            const task = readJson(taskFile);
            assert(/^[0-9a-f]{32}$/.test(d.dispatch_nonce), 'nonce shape');
            assert(task.context.binding.dispatch_nonce === d.dispatch_nonce, 'the nonce is not inside the task');
            assert(
                task.context.binding.expected_trace_sha256 === d.trace_sha256,
                'the trace hash is not inside the task',
            );
            assert(
                d.expected.failing_line === 45 && d.expected.spec_sha256 === task.context.spec.sha256,
                'expected fields',
            );
            assert(
                d.verifier.command.some((t) => t.startsWith('<run>/verify/')),
                'portable verifier command line',
            );
            for (const file of [taskFile, traceFile]) {
                assert((fs.statSync(file).mode & 0o222) === 0, `${path.basename(file)} is writable`);
            }
            assert(d.frozen_read_only === true, 'frozen flag');
            if (process.getuid?.() !== 0) {
                let blocked = false;
                try {
                    fs.writeFileSync(taskFile, 'x');
                } catch {
                    blocked = true;
                }
                assert(blocked, 'the frozen task file accepted a write');
            }
            const proc = json(out, 'verify', 'process.json');
            assert(proc.spawned && proc.exit_code === 0 && Number.isInteger(proc.pid), 'process record');
            assert(proc.elapsed_seconds > 0 && !proc.timed_out && proc.blocker === null, 'process timing');
            assert(proc.post_teardown.confirmed === true, 'teardown after the verifier');
            assert(proc.dispatch_nonce === d.dispatch_nonce && proc.task_id === d.task_id, 'process record binding');
            assert(proc.argv[0] === 'node' && proc.argv[1].endsWith('verifier/bookmarks_verifier.mjs'), 'argv script');
            const rest = proc.argv.slice(2);
            assert(
                rest.length === 8 && rest.filter((t) => t.startsWith('--')).length === 4,
                `argv shape: ${JSON.stringify(rest)}`,
            );
            for (const token of rest.filter((t) => !t.startsWith('--'))) {
                assert(
                    path.isAbsolute(token) && token.length < 300 && !/[{}"\n]/.test(token),
                    'argv holds a non-path value',
                );
            }
            const argvText = proc.argv.join(' ');
            for (const secret of [d.dispatch_nonce, d.task_sha256, d.trace_sha256, task.task_id, '"']) {
                assert(!argvText.includes(secret), 'a content value reached the verifier command line');
            }
            assert(proc.scratch_cwd === true, 'scratch cwd');
            assert(
                proc.env_names.includes('PATH') &&
                    proc.env_names.includes('MM_LICENSE') &&
                    !proc.env_names.includes('ORCH_SECRET_SENTINEL') &&
                    !proc.env_names.includes('PILOT_AGENT_TASK'),
                `env names: ${proc.env_names.join(',')}`,
            );
            const result = json(out, 'verify', 'agent-result.json');
            assert(validate('verifier', result).ok, 'the verifier result does not validate');
            assert(result.verdict === 'pass', `verifier verdict ${result.verdict}: ${result.notes}`);
            const receipt = result.receipt;
            assert(
                receipt.run_id === 'selftest-h1' &&
                    receipt.task_id === d.task_id &&
                    receipt.dispatch_nonce === d.dispatch_nonce &&
                    receipt.task_sha256_observed === d.task_sha256 &&
                    receipt.trace_sha256_observed === d.trace_sha256 &&
                    receipt.verifier_kind === 'deterministic-process',
                'receipt',
            );
            assert(result.reproduced_failure.step_evidence_summary.length === 8, 'step evidence');
            assert(
                result.reproduced_failure.failing_line === 45 && result.reproduced_failure.only_one_error,
                'failure',
            );
            const calls = fake.calls();
            assert(
                calls.filter((c) => c === 'gate').length === 2,
                `the verifier did not bring up its own stack: ${calls}`,
            );
            assert(calls.filter((c) => c === 'replay').length === 6, 'replays: 3 coordinator + 3 verifier');
            assert(calls.lastIndexOf('down') > calls.lastIndexOf('replay'), 'the verifier did not tear its stack down');
            assert(!fs.existsSync(path.join(fake.run, 'seed-manifest.json')), 'a stack is still up');
            const summary = json(out, 'summary.json');
            assert(summary.verdict === 'pass' && summary.spec.unchanged_at_every_stage === true, 'summary verdict');
            assert(
                summary.delivery.nonce_echo_matches &&
                    summary.delivery.hashes_match &&
                    summary.delivery.verifier_exit_code === 0,
                'summary delivery',
            );
            assert(
                summary.results[2].produced_by.includes('deterministic verifier process'),
                'producer of the independent row',
            );
            assert(
                summary.results.every((x) => x.status === 'verified'),
                JSON.stringify(summary.results),
            );
            const md = fs.readFileSync(path.join(out, 'summary.md'), 'utf8');
            assert(md.includes(d.dispatch_nonce) && md.includes('process: same worker'), 'summary.md');
            const collect = json(out, 'collect', 'collect.json');
            assert(
                collect.accepted && Object.values(collect.delivery_checks).every(Boolean),
                'collect delivery checks',
            );
            assert(
                unsafeFindings(fs.readFileSync(path.join(out, 'verify', 'dispatch.json'), 'utf8'), {allowSlugs: true})
                    .length === 0,
                'dispatch leak',
            );
            assert(
                !fs.existsSync(path.join(out, 'agent-calls.jsonl')),
                'a deterministic verifier is not an agent call',
            );
            const {failures} = validateOutDir(out);
            assert(failures.length === 0, `artifact validation: ${JSON.stringify(failures)}`);
            flow.fake = fake;
            flow.out = out;
            flow.result = result;
            flow.dispatch = dispatch;
            flow.task = task;
        },
    );

    const direct = (label, edit) => {
        const dir = newDir(label);
        fs.mkdirSync(dir, {recursive: true});
        const d = flow.dispatch.delivery;
        const taskBytes = fs.readFileSync(path.join(flow.out, 'verify', 'agent-task.json'));
        const traceBytes = fs.readFileSync(path.join(flow.out, '2-control', 'failure-trace.json'));
        const files = {
            task: path.join(dir, 'agent-task.json'),
            trace: path.join(dir, 'failure-trace.json'),
            binding: path.join(dir, 'dispatch-binding.json'),
            out: path.join(dir, 'agent-result.json'),
        };
        const state = {
            task: taskBytes,
            trace: traceBytes,
            binding: {
                run_id: d.run_id,
                task_id: d.task_id,
                dispatch_nonce: d.dispatch_nonce,
                task_sha256: d.task_sha256,
                trace_sha256: d.trace_sha256,
                spec_sha256: d.expected.spec_sha256,
            },
        };
        edit?.(state);
        fs.writeFileSync(files.task, state.task);
        if (state.trace !== null) {
            fs.writeFileSync(files.trace, state.trace);
        }
        fs.writeFileSync(files.binding, JSON.stringify(state.binding));
        const before = flow.fake.calls().length;
        const r = spawnSync(
            'node',
            [VERIFIER, '--task', files.task, '--trace', files.trace, '--out', files.out, '--nonce-file', files.binding],
            {
                cwd: dir,
                encoding: 'utf8',
                env: flow.fake.env,
            },
        );
        const result = fs.existsSync(files.out) ? readJson(files.out) : null;
        return {status: r.status, result, calls: flow.fake.calls().length - before, files};
    };

    await check(
        'the verifier refuses altered task bytes, altered trace bytes, a missing trace and a foreign nonce (exit 3, blocked, no stack started)',
        () => {
            const sha256FromBuffer = (buffer) => crypto.createHash('sha256').update(buffer).digest('hex');
            const cases = [
                {
                    name: 'altered task bytes',
                    edit: (s) => {
                        s.task = Buffer.concat([s.task, Buffer.from('\n ')]);
                    },
                    reason: 'task_bytes_differ_from_dispatched_hash',
                    receipt: (res, s) => res.receipt.task_sha256_observed === sha256FromBuffer(s.task),
                },
                {
                    name: 'altered trace bytes',
                    edit: (s) => {
                        s.trace = Buffer.concat([s.trace, Buffer.from('\n ')]);
                    },
                    reason: 'trace_bytes_differ_from_dispatched_hash',
                    receipt: (res, s) => res.receipt.trace_sha256_observed === sha256FromBuffer(s.trace),
                },
                {
                    name: 'missing trace',
                    edit: (s) => {
                        s.trace = null;
                    },
                    reason: 'trace_missing_or_not_json',
                    receipt: (res) => res.receipt.trace_sha256_observed === null,
                },
                {
                    name: 'a foreign nonce in the binding',
                    edit: (s) => {
                        s.binding.dispatch_nonce = 'e'.repeat(32);
                    },
                    reason: 'task_nonce_differs_from_binding',
                    receipt: (res) => res.receipt.dispatch_nonce === 'e'.repeat(32),
                },
            ];
            for (const c of cases) {
                let observed;
                const r = direct('h-refuse', (s) => {
                    c.edit(s);
                    observed = s;
                });
                assert(r.status === 3, `${c.name}: expected exit 3, got ${r.status}`);
                assert(r.result?.verdict === 'blocked', `${c.name}: verdict ${r.result?.verdict}`);
                assert(r.result.notes.includes(c.reason), `${c.name}: notes ${r.result.notes}`);
                assert(validate('verifier', r.result).ok, `${c.name}: the refusal does not validate`);
                assert(r.calls === 0, `${c.name}: the verifier touched infra before it proved its inputs`);
                assert(c.receipt(r.result, observed), `${c.name}: receipt does not state what was observed`);
            }
        },
    );

    const collectCopy = (label, edit, extra = []) => {
        const dir = newDir(label);
        fs.cpSync(flow.out, dir, {recursive: true});
        edit?.(dir);
        const r = pilot(['run', '--resume', '--out', dir, '--from', 'collect', ...extra], flow.fake.env);
        return {...r, dir};
    };
    const editResult = (patch) => (dir) => {
        const file = path.join(dir, 'verify', 'agent-result.json');
        const doc = readJson(file);
        patch(doc);
        fs.writeFileSync(file, JSON.stringify(doc, null, 2));
    };
    const incomplete = (r, label, pattern, {resultMoved = true} = {}) => {
        assert(r.status === EXIT.INCOMPLETE, `${label}: expected exit 30, got ${r.status}\n${r.stdout}`);
        const summary = json(r.dir, 'summary.json');
        assert(summary.verdict === 'incomplete', `${label}: summary verdict ${summary.verdict}`);
        assert(
            summary.results.find((x) => x.step === 'independent_reproduction').status === 'pending',
            `${label}: independent row`,
        );
        const collect = json(r.dir, 'collect', 'collect.json');
        assert(collect.accepted === false && collect.run_verdict === 'incomplete', `${label}: collect record`);
        assert(pattern.test(collect.blocker), `${label}: blocker "${collect.blocker}"`);
        assert(summary.blocker === collect.blocker, `${label}: summary blocker`);
        assert(
            fs.existsSync(path.join(r.dir, 'verify', 'agent-result.json')) !== resultMoved,
            `${label}: the result file is ${resultMoved ? 'still' : 'no longer'} in place`,
        );
        assert(stageRecordResult(r.dir) === 'incomplete', `${label}: stage record`);
    };
    const stageRecordResult = (dir) => json(dir, 'collect', 'stage-record.json').result;

    await check(
        'collect rejects stale-nonce, other-run, other-task, wrong-assertion, unbound and hash-mismatching results: verdict stays incomplete (exit 30), never pass',
        () => {
            const cases = [
                [
                    'stale nonce',
                    (r) => {
                        r.receipt.dispatch_nonce = 'f'.repeat(32);
                    },
                    /dispatch_nonce/,
                ],
                [
                    'another run id',
                    (r) => {
                        r.receipt.run_id = 'another-run';
                    },
                    /run_id/,
                ],
                [
                    'another task id',
                    (r) => {
                        r.task_id = 'collect-foreign-0000000000';
                        r.receipt.task_id = 'collect-foreign-0000000000';
                    },
                    /task_id/,
                ],
                [
                    'a pass that failed at the wrong assertion',
                    (r) => {
                        r.reproduced_failure.failing_line = 46;
                    },
                    /wrong assertion/,
                ],
                [
                    'an honest fail at the wrong assertion',
                    (r) => {
                        r.verdict = 'fail';
                        r.reproduced_failure.failing_line = 46;
                        r.reproduced_failure.judge = 'fail';
                    },
                    /wrong assertion/,
                ],
                [
                    'a missing receipt',
                    (r) => {
                        delete r.receipt;
                    },
                    /receipt: missing/,
                ],
                [
                    'a different trace hash',
                    (r) => {
                        r.receipt.trace_sha256_observed = 'b'.repeat(64);
                    },
                    /trace_sha256_observed/,
                ],
                [
                    'a missing task hash',
                    (r) => {
                        r.receipt.task_sha256_observed = null;
                    },
                    /task_sha256_observed/,
                ],
                [
                    'unsafe text',
                    (r) => {
                        r.notes = 'seen at http://127.0.0.1:8065/x';
                    },
                    /unsafe-text/,
                ],
            ];
            for (const [name, patch, pattern] of cases) {
                const r = collectCopy('h-reject', editResult(patch));
                incomplete(r, name, /rejected/);
                const errors = json(r.dir, 'collect', 'agent-result.errors.json').errors.join('\n');
                assert(pattern.test(errors), `${name}: errors ${errors}`);
                assert(fs.existsSync(path.join(r.dir, 'collect', 'agent-result.rejected.json')), `${name}: set aside`);
                assert(!/127\.0\.0\.1|selftest-h1/.test(errors), `${name}: errors echo instance data`);
            }
        },
    );

    await check(
        'collect: a spec hash seen by the verifier that differs is a hard failure (exit 1); a result written before this feature (no receipt) is still valid in manual mode',
        () => {
            const r = collectCopy(
                'h-sha',
                editResult((x) => {
                    x.spec_sha256_observed = 'a'.repeat(64);
                }),
            );
            assert(r.status === EXIT.FAIL, `expected exit 1, got ${r.status}\n${r.stdout}`);
            const summary = json(r.dir, 'summary.json');
            assert(summary.verdict === 'fail' && summary.spec.unchanged_at_every_stage === false, 'summary');
            const old = {...flow.result};
            delete old.receipt;
            assert(validate('verifier', old).ok, 'a result without a receipt must still validate against the schema');
        },
    );

    await check(
        'collect: altered or missing frozen inputs, a verifier that never ran, a crashed one and a stale result from an earlier dispatch leave the run incomplete',
        () => {
            const thawed = (rel) => (dir) => {
                const file = path.join(dir, rel);
                fs.chmodSync(file, 0o644);
                fs.appendFileSync(file, ' ');
            };
            const altered = collectCopy('h-alt-task', thawed('verify/agent-task.json'));
            incomplete(altered, 'altered task after dispatch', /frozen task file/, {resultMoved: false});
            const trace = collectCopy('h-alt-trace', thawed('2-control/failure-trace.json'));
            incomplete(trace, 'altered trace after dispatch', /frozen failure trace/, {resultMoved: false});
            const gone = collectCopy('h-gone', (dir) => {
                fs.rmSync(path.join(dir, 'verify', 'agent-result.json'));
                fs.rmSync(path.join(dir, 'verify', 'process.json'));
            });
            incomplete(gone, 'verifier never ran', /did not run/);
            const crashed = collectCopy('h-crash', (dir) => {
                fs.rmSync(path.join(dir, 'verify', 'agent-result.json'));
                const file = path.join(dir, 'verify', 'process.json');
                const proc = readJson(file);
                Object.assign(proc, {
                    exit_code: 1,
                    result_file_present: false,
                    blocker: 'the verifier process exited 1 without writing a result',
                });
                fs.writeFileSync(file, JSON.stringify(proc));
            });
            incomplete(crashed, 'verifier crashed', /exited 1 without writing a result/);
            assert(json(crashed.dir, 'summary.json').delivery.verifier_exit_code === 1, 'exit code in the summary');
        },
    );

    await check(
        'timeout: a verifier that exceeds its time budget is killed, recorded in process.json, the stack is torn down and the run is incomplete (exit 30)',
        () => {
            const fake = fakeInfra({FAKE_VERIFIER_SLEEP: '4000'});
            const out = newDir('h-timeout');
            const r = pilot(processArgs(out, 'selftest-h-timeout', ['--verifier-timeout', '1']), fake.env);
            assert(r.status === EXIT.INCOMPLETE, `expected exit 30, got ${r.status}\n${r.stdout}`);
            const proc = json(out, 'verify', 'process.json');
            assert(
                proc.timed_out === true && proc.spawned === true && proc.result_file_present === false,
                'process record',
            );
            assert(proc.signal === 'SIGKILL' && proc.exit_code === null, 'killed');
            assert(/time budget/.test(proc.blocker), `blocker ${proc.blocker}`);
            assert(proc.post_teardown.confirmed === true, 'teardown after the timeout');
            assert(!fs.existsSync(path.join(fake.run, 'seed-manifest.json')), 'a stack is left');
            const summary = json(out, 'summary.json');
            assert(summary.verdict === 'incomplete' && /time budget/.test(summary.blocker), 'summary');
            assert(summary.delivery.hashes_match === false && summary.delivery.nonce_echo === null, 'delivery section');
            assert(json(out, 'verify', 'stage-record.json').result === 'pass', 'dispatch stage');
            assert(stageRecordResult(out) === 'incomplete', 'collect stage');
        },
    );

    await check(
        're-dispatch with --force: a new nonce and new hashes, the earlier result is set aside as stale and cannot be replayed into the new dispatch',
        () => {
            const out = newDir('h-redispatch');
            fs.cpSync(flow.out, out, {recursive: true});
            const first = json(out, 'verify', 'dispatch.json').delivery;
            const r = pilot(['run', '--resume', '--out', out, '--from', 'dispatch', '--force'], flow.fake.env);
            assert(r.status === 0, `exit ${r.status}\n${r.stdout}\n${r.stderr}`);
            const second = json(out, 'verify', 'dispatch.json').delivery;
            assert(second.dispatch_nonce !== first.dispatch_nonce, 'the nonce was reused');
            assert(second.task_sha256 !== first.task_sha256, 'the task bytes did not change with the nonce');
            assert(second.trace_sha256 === first.trace_sha256, 'the trace changed');
            assert(
                fs.existsSync(path.join(out, 'verify', 'agent-result.stale.1.json')),
                'the old result was not set aside',
            );
            assert(json(out, 'summary.json').verdict === 'pass', 'second dispatch summary');
            assert(sha256File(path.join(out, 'verify', 'agent-task.json')) === second.task_sha256, 'second task bytes');
            const stale = collectCopy('h-stale', (dir) => {
                fs.copyFileSync(path.join(out, 'verify', 'dispatch.json'), path.join(dir, 'verify', 'dispatch.json'));
                fs.chmodSync(path.join(dir, 'verify', 'agent-task.json'), 0o644);
                fs.copyFileSync(
                    path.join(out, 'verify', 'agent-task.json'),
                    path.join(dir, 'verify', 'agent-task.json'),
                );
                fs.writeFileSync(path.join(dir, 'verify', 'agent-result.json'), JSON.stringify(flow.result));
            });
            assert(stale.status === EXIT.INCOMPLETE, `stale result: exit ${stale.status}\n${stale.stdout}`);
            assert(/dispatch_nonce|task_id/.test(json(stale.dir, 'collect', 'collect.json').blocker), 'stale blocker');
            thawTree(out);
        },
    );

    await check(
        'interruption: SIGKILL after stage 0 and after the baseline leaves the run directory and the stack; resume keeps stage 0 byte for byte, one attempt, session key and fingerprint',
        () => {
            const fake = fakeInfra();
            const out = newDir('h-interrupt');
            const id = 'selftest-h-int';
            const first = pilot(processArgs(out, id, ['--to', 'target', '--keep-stack']), fake.env);
            assert(first.status === 0, `S0 exit ${first.status}\n${first.stdout}`);
            const s0 = stage0Hashes(out);
            const fingerprint = json(out, '0-target', 'attempt-1', 'setup.json').fixture_fingerprint;
            const killed = pilot(
                [
                    'run',
                    '--resume',
                    '--run-id',
                    id,
                    '--out',
                    out,
                    '--verifier=process',
                    '--interrupt-after-stage',
                    'baseline',
                ],
                fake.env,
            );
            assert(
                killed.status === null && killed.signal === 'SIGKILL',
                `expected SIGKILL, got ${killed.status}/${killed.signal}`,
            );
            assert(/interrupt hook: SIGKILL after stage 1-baseline/.test(killed.stdout), killed.stdout);
            assert(json(out, '1-baseline', 'stage-record.json').result === 'pass', 'baseline record missing');
            assert(!fs.existsSync(path.join(out, '2-control')), 'the run continued past the hook');
            const manifest = json(fake.run, 'seed-manifest.json');
            assert(manifest.session?.name === 'bookmarks', 'the stack or the manifest session key is gone');
            assert(same(stage0Hashes(out), s0), 'stage 0 changed by the interrupted invocation');
            const resumed = pilot(['run', '--resume', '--run-id', id, '--out', out], fake.env);
            assert(resumed.status === 0, `resume exit ${resumed.status}\n${resumed.stdout}\n${resumed.stderr}`);
            assert(
                /0-target\s+reused/.test(resumed.stdout) && /1-baseline\s+up to date/.test(resumed.stdout),
                resumed.stdout,
            );
            assert(same(stage0Hashes(out), s0), 'stage 0 changed on resume');
            const status = json(out, '0-target', 'status.json');
            assert(status.attempts.length === 1 && status.current_attempt === 1, 'attempts');
            assert(json(out, '0-target', 'attempt-1', 'setup.json').fixture_fingerprint === fingerprint, 'fingerprint');
            assert(json(out, 'summary.json').verdict === 'pass', 'resumed run did not finish');
            const invocations = json(out, 'commands.json').invocations;
            assert(
                invocations.length === 3 && invocations[1].exit_code === null && invocations[2].exit_code === 0,
                `commands record: ${JSON.stringify(invocations.map((i) => i.exit_code))}`,
            );
        },
    );

    await check(
        'interruption: an external SIGKILL in the middle of the baseline replay; resume reruns the stage on the same stage 0',
        async () => {
            const fake = fakeInfra({FAKE_REPLAY_SLEEP: '2500'});
            const out = newDir('h-kill-mid');
            const id = 'selftest-h-mid';
            const first = pilot(processArgs(out, id, ['--to', 'target', '--keep-stack']), fake.env);
            assert(first.status === 0, `S0 exit ${first.status}`);
            const s0 = stage0Hashes(out);
            const running = pilotAsync(['run', '--resume', '--run-id', id, '--out', out], fake.env);
            for (let i = 0; i < 100 && !fake.calls().includes('replay'); i++) {
                // eslint-disable-next-line no-await-in-loop
                await sleep(100);
            }
            assert(fake.calls().includes('replay'), 'the baseline replay did not start');
            running.child.kill('SIGKILL');
            const ended = await running.done;
            assert(ended.signal === 'SIGKILL', `expected SIGKILL, got ${ended.signal}`);
            assert(!fs.existsSync(path.join(out, '1-baseline', 'stage-record.json')), 'a half-run stage left a record');
            assert(fs.existsSync(path.join(fake.run, 'seed-manifest.json')), 'the stack was lost');
            await sleep(3000);
            const env = {...fake.env};
            delete env.FAKE_REPLAY_SLEEP;
            const resumed = pilot(['run', '--resume', '--run-id', id, '--out', out], env);
            assert(resumed.status === 0, `resume exit ${resumed.status}\n${resumed.stdout}`);
            assert(
                /0-target\s+reused/.test(resumed.stdout) && /1-baseline\s+pass/.test(resumed.stdout),
                resumed.stdout,
            );
            assert(same(stage0Hashes(out), s0), 'stage 0 changed');
            assert(json(out, '0-target', 'status.json').attempts.length === 1, 'attempts');
        },
    );

    await check(
        'recovery: a resume of a completed run is a no-op; with --recover-fixture a lost fixture starts attempt-2, keeps attempt-1 and the old evidence, and reruns every stage on the new fixture',
        () => {
            const out = newDir('h-recover');
            fs.cpSync(flow.out, out, {recursive: true});
            const callsBefore = flow.fake.calls().length;
            const plain = pilot(['run', '--resume', '--out', out], flow.fake.env);
            assert(plain.status === 0, `plain resume exit ${plain.status}\n${plain.stdout}`);
            assert(flow.fake.calls().length === callsBefore, 'a plain resume of a completed run touched the infra');
            const a1 = attemptHashes(out, 1);
            const oldSummary = sha256File(path.join(out, 'summary.json'));
            const oldBaseline = sha256File(path.join(out, '1-baseline', 'baseline.json'));
            spawnSync('node', [FAKE, 'down'], {env: flow.fake.env});
            const r = pilot(['run', '--resume', '--out', out, '--recover-fixture'], flow.fake.env);
            assert(r.status === 0, `recovery exit ${r.status}\n${r.stdout}\n${r.stderr}`);
            const status = json(out, '0-target', 'status.json');
            assert(status.attempts.length === 2 && status.current_attempt === 2, 'attempts');
            assert(/^fixture_lost:/.test(status.attempts[1].reason), `reason ${status.attempts[1].reason}`);
            assert(same(attemptHashes(out, 1), a1), 'attempt-1 changed');
            const f1 = json(out, '0-target', 'attempt-1', 'setup.json').fixture_fingerprint;
            const f2 = json(out, '0-target', 'attempt-2', 'setup.json').fixture_fingerprint;
            assert(f1 !== f2, 'the new fixture must have a different fingerprint');
            const baseline = json(out, '1-baseline', 'baseline.json');
            assert(baseline.fixture.fingerprint_before === f2, 'the baseline was reused as proof for the new fixture');
            assert(
                sha256File(path.join(out, '1-baseline', 'baseline.json')) !== oldBaseline || f1 === f2,
                'baseline not rerun',
            );
            const archived = path.join(out, 'superseded', 'after-attempt-1');
            assert(
                sha256File(path.join(archived, 'summary.json')) === oldSummary,
                'old summary not preserved byte for byte',
            );
            assert(fs.existsSync(path.join(archived, 'verify', 'dispatch.json')), 'old dispatch not preserved');
            const summary = json(out, 'summary.json');
            assert(summary.verdict === 'pass' && summary.fixture_attempts.length === 2, 'summary after recovery');
            assert(
                summary.fixture_attempts[0].fingerprint !== summary.fixture_attempts[1].fingerprint,
                'fingerprints in summary',
            );
            assert(summary.superseded.includes('superseded/after-attempt-1'), 'superseded list');
            assert(summary.fixture_fingerprint === f2, 'summary fingerprint is the new fixture');
            assert(
                json(out, 'verify', 'dispatch.json').delivery.dispatch_nonce !== flow.dispatch.delivery.dispatch_nonce,
                'new dispatch',
            );
            const {failures} = validateOutDir(out);
            assert(failures.length === 0, `artifact validation: ${JSON.stringify(failures)}`);
        },
    );

    await check(
        'image override: a reference without a digest is refused; a digest-pinned one reaches gate and up through MATTERMOST_PILOT_IMAGE without --target and is recorded in the target',
        () => {
            const ref = `ghcr.io/example/mattermost-enterprise-edition:9.9.9@${DIGEST}`;
            assert(parseImage(ref, 'x').digest === DIGEST, 'parse');
            let refused = false;
            try {
                parseImage('mattermost/mattermost-enterprise-edition:12.1.0', 'x');
            } catch {
                refused = true;
            }
            assert(refused, 'a reference without a digest was accepted');
            const fake = fakeInfra();
            const bad = pilot(
                processArgs(newDir('h-img-bad'), 'selftest-img-bad', ['--image', 'repo:tag', '--to', 'target']),
                fake.env,
            );
            assert(
                bad.status === EXIT.USAGE && /digest/.test(bad.stderr),
                `expected exit 2, got ${bad.status}\n${bad.stderr}`,
            );
            const viaEnv = pilot(processArgs(newDir('h-img-env'), 'selftest-img-env', ['--to', 'target']), {
                ...fake.env,
                MATTERMOST_PILOT_IMAGE: 'repo:tag',
            });
            assert(viaEnv.status === EXIT.USAGE, `env without digest: exit ${viaEnv.status}`);
            const dry = newDir('h-img-dry');
            const planned = pilot(
                [
                    'run',
                    '--target',
                    'release',
                    '--dry-run',
                    '--verifier=process',
                    '--image',
                    ref,
                    '--run-id',
                    'selftest-img-dry',
                    '--out',
                    dry,
                    '--verify-spec',
                    'explorer-proto/sessions/bookmarks/generated/channels_bookmarks_bar_follows_switch.spec.ts',
                    '--engine-charter',
                    'session:bookmarks',
                    '--control',
                    'release-bookmark-title-changed',
                ],
                fake.env,
            );
            assert(planned.status === 0, `dry run exit ${planned.status}\n${planned.stdout}${planned.stderr}`);
            const plan = json(dry, 'plan.json');
            assert(plan.image.source === 'override' && plan.image.reference === ref, 'plan image');
            assert(
                plan.commands[0].every((t) => !t.startsWith('--target=')),
                'plan commands still pass --target',
            );
            assert(validate('orch#run-plan', plan).ok && json(dry, 'run.json').image === ref, 'plan or run.json');
            assert(fake.calls().length === 0, 'a dry run touched the infra');
            const out = newDir('h-img');
            const r = pilot(
                processArgs(out, 'selftest-img', ['--image', ref, '--to', 'target', '--keep-stack']),
                fake.env,
            );
            assert(r.status === 0, `exit ${r.status}\n${r.stdout}\n${r.stderr}`);
            const args = fake.args();
            assert(
                args.length === 2 && args.every((l) => !l.includes('--target=') && l.endsWith(`image=${ref}`)),
                `gate and up args: ${args.join(' | ')}`,
            );
            const target = json(out, '0-target', 'attempt-1', 'target.json');
            assert(target.image.digest === DIGEST && target.image.ref.startsWith('ghcr.io/example/'), 'target record');
            assert(json(out, '0-target', 'attempt-1', 'setup.json').image_digest === DIGEST, 'setup digest');
            const checks = json(out, '0-target', 'attempt-1', 'target-check.json').checks;
            assert(checks.find((c) => c.id === 'image_pin_matches_lib_sh').result === 'info', 'pin check');
            const again = pilot(
                ['run', '--resume', '--run-id', 'selftest-img', '--out', out, '--to', 'target', '--keep-stack'],
                fake.env,
            );
            assert(
                again.status === 0 && /0-target\s+reused/.test(again.stdout),
                `resume keeps the image: ${again.stdout}`,
            );
            const plainFake = fakeInfra();
            const plain = pilot(
                processArgs(newDir('h-img-plain'), 'selftest-img-plain', ['--to', 'target', '--keep-stack']),
                plainFake.env,
            );
            assert(plain.status === 0, 'plain run');
            assert(
                plainFake.args().every((l) => l.includes('--target=default') && l.endsWith('image=unset')),
                `default behaviour changed: ${plainFake.args().join(' | ')}`,
            );
        },
    );

    await check(
        'headless CI entry: export copies only allowlisted, sanitized files and fails closed; summary --github; doctor prints PASS/FAIL without values; dry-run plan needs no Docker',
        () => {
            const dest = newDir('h-export');
            const ok = pilot(['export', '--run-dir', flow.out, '--out', dest], flow.fake.env);
            assert(ok.status === 0, `export exit ${ok.status}\n${ok.stdout}\n${ok.stderr}`);
            const files = listFiles(dest);
            for (const must of [
                'summary.json',
                'summary.md',
                'verify/dispatch.json',
                'verify/process.json',
                'verify/agent-task.json',
                'verify/agent-result.json',
                '2-control/failure-trace.json',
                'commands.json',
                'export-manifest.json',
                'run.json',
            ]) {
                assert(files.includes(must), `export lacks ${must}`);
            }
            assert(
                !files.some((f) => /\.log$|\.state|agent-calls|\.work|stage-record/.test(f)),
                `export holds a non-allowlisted file: ${files}`,
            );
            const manifest = json(dest, 'export-manifest.json');
            assert(validate('orch#export-manifest', manifest).ok, 'export manifest');
            assert(manifest.task_sha256 === flow.dispatch.delivery.task_sha256, 'task hash in the export');
            assert(manifest.trace_sha256 === flow.dispatch.delivery.trace_sha256, 'trace hash in the export');
            assert(manifest.leak_scan.unsafe_text === 'PASS' && manifest.leak_scan.licence === 'PASS', 'leak scan');
            assert(
                manifest.manifest_session.session_name === 'bookmarks' && manifest.manifest_session.attempts === 1,
                'manifest session summary',
            );
            for (const f of files) {
                const text = fs.readFileSync(path.join(dest, f), 'utf8');
                assert(
                    !text.includes(REPO_ROOT) && !text.includes(LICENCE_PLACEHOLDER),
                    `${f} carries a local path or the licence`,
                );
                assert(!/127\.0\.0\.1|localhost|http:\/\//.test(text), `${f} carries an origin`);
            }
            for (const entry of manifest.files) {
                assert(entry.sha256 === sha256File(path.join(dest, entry.path)), `hash of ${entry.path}`);
            }
            const planted = newDir('h-export-src');
            fs.cpSync(flow.out, planted, {recursive: true});
            fs.writeFileSync(path.join(planted, 'verify', 'notes.log'), 'private log');
            fs.symlinkSync('/etc/hostname', path.join(planted, 'verify', 'link.json'));
            const dest2 = newDir('h-export-2');
            assert(
                pilot(['export', '--run-dir', planted, '--out', dest2], flow.fake.env).status === 0,
                'export with extra files',
            );
            assert(!listFiles(dest2).some((f) => /notes\.log|link\.json/.test(f)), 'a log or a symlink was exported');
            fs.appendFileSync(path.join(planted, 'summary.md'), `\n${LICENCE_PLACEHOLDER}\n`);
            const dest3 = newDir('h-export-3');
            const leaked = pilot(['export', '--run-dir', planted, '--out', dest3], flow.fake.env);
            assert(
                leaked.status === EXIT.FAIL && !fs.existsSync(dest3),
                `leak scan must fail closed: ${leaked.status}`,
            );
            assert(!leaked.stdout.includes(LICENCE_PLACEHOLDER), 'the export printed the licence');
            const noLicence = {...flow.fake.env};
            delete noLicence.MM_LICENSE;
            const dest4 = newDir('h-export-4');
            const blocked = pilot(['export', '--run-dir', flow.out, '--out', dest4], noLicence);
            assert(
                blocked.status === EXIT.BLOCKED && !fs.existsSync(dest4),
                `no licence to scan with: ${blocked.status}`,
            );
            const inside = pilot(
                ['export', '--run-dir', flow.out, '--out', path.join(flow.out, 'exported')],
                flow.fake.env,
            );
            assert(inside.status === EXIT.USAGE, 'an export inside the run directory must be refused');
            const gh = pilot(['summary', '--run-dir', flow.out, '--github'], flow.fake.env);
            assert(
                gh.status === 0 &&
                    /### Explorer pilot: PASS/.test(gh.stdout) &&
                    /Delivery: process: same worker/.test(gh.stdout),
                gh.stdout,
            );
            assert(gh.stdout.split('\n').length < 30, 'the GitHub summary should be short');
            const doctor = pilot(['doctor', '--no-docker'], flow.fake.env);
            assert([0, 3].includes(doctor.status), `doctor exit ${doctor.status}`);
            assert(
                /^PASS node version/m.test(doctor.stdout) &&
                    /^PASS MM_LICENSE present \(name only\)/m.test(doctor.stdout),
                doctor.stdout,
            );
            assert(
                /^SKIP docker reachable/m.test(doctor.stdout) && /^doctor: (PASS|FAIL)/m.test(doctor.stdout),
                doctor.stdout,
            );
            assert(!doctor.stdout.includes(LICENCE_PLACEHOLDER), 'doctor printed the licence');
            const bare = {...flow.fake.env};
            delete bare.MM_LICENSE;
            assert(
                /^FAIL MM_LICENSE present/m.test(pilot(['doctor', '--no-docker'], bare).stdout),
                'doctor without a licence',
            );
            const readme = fs.readFileSync(path.join(ORCH_DIR, 'README.md'), 'utf8');
            const section = readme.slice(readme.indexOf('## Headless CI entry'));
            for (const needle of [
                '--image',
                'MATTERMOST_PILOT_IMAGE',
                'export',
                '--github',
                'doctor',
                '--dry-run',
                '`30`',
                '`20`',
                '`3`',
                'export-manifest.json',
            ]) {
                assert(section.includes(needle), `the README section lacks ${needle}`);
            }
        },
    );

    await check(
        'verifier isolation by construction: it names no coordinator record, the environment is an allowlist, command lines are paths only, a result without a receipt validates but is rejected',
        () => {
            const sources = listFiles(path.join(ORCH_DIR, 'verifier')).map((f) =>
                fs.readFileSync(path.join(ORCH_DIR, 'verifier', f), 'utf8'),
            );
            for (const source of sources) {
                for (const forbidden of [
                    'stage-record',
                    'run.json',
                    'control.json',
                    'dispatch.json',
                    'agent-calls',
                    'baseline.json',
                    'summary.json',
                    'collect.json',
                    '.state',
                    'process.json',
                ]) {
                    assert(
                        !source.includes(forbidden),
                        `the verifier source names the coordinator record ${forbidden}`,
                    );
                }
            }
            const {env, names} = scrubbedEnv({
                PATH: '/bin',
                MM_LICENSE: 'x',
                SECRET_ORCH: 'y',
                PILOT_AGENT_TASK: 'z',
                PILOT_VERIFIER_PASS_ENV: 'FAKE_RUN',
                FAKE_RUN: '/r',
                FAKE_OTHER: 'o',
            });
            assert(same(names, ['FAKE_RUN', 'MM_LICENSE', 'PATH']) && env.SECRET_ORCH === undefined, `env: ${names}`);
            const argv = verifierArgv({
                task: '/r/verify/agent-task.json',
                trace: '/r/2-control/failure-trace.json',
                out: '/r/verify/agent-result.json',
                nonceFile: '/s/dispatch-binding.json',
            });
            assert(
                same(portableArgv(argv, {run: '/r', scratch: '/s'}).slice(2), [
                    '--task',
                    '<run>/verify/agent-task.json',
                    '--trace',
                    '<run>/2-control/failure-trace.json',
                    '--out',
                    '<run>/verify/agent-result.json',
                    '--nonce-file',
                    '<scratch>/dispatch-binding.json',
                ]),
                'portable argv',
            );
        },
    );
}
