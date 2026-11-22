// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable @stylistic/indent, @stylistic/multiline-ternary, @stylistic/operator-linebreak -- Prettier owns formatting and the repo config relaxes these rules for .ts/.js only */

// S3, dispatch: writes the independent verifier's task (verify/agent-task.json) from the orchestrator's own records,
// stops the stack so the verifier starts clean, records both, and hands the task over. With --verifier=manual (default)
// the run halts with exit 20 awaiting an agent result that S4 collects on a later --resume. With --verifier=process the
// two input files are frozen read-only, bound to this dispatch by a nonce, and a deterministic verifier is started as a
// separate OS process (see handoff.mjs); S4 then collects its result in the same invocation.
import fs from 'node:fs';
import path from 'node:path';

import {loadControl} from './control_def.mjs';
import {
    DEFAULT_TIMEOUT_SECONDS,
    DELIVERY_MODE,
    ENV_POLICY,
    freezeReadOnly,
    isFrozen,
    makeScratchDir,
    newNonce,
    portableArgv,
    scrubbedEnv,
    spawnVerifier,
    thaw,
    VERIFIER_KIND,
    verifierArgv,
    VERIFIER_SCRIPT,
    writeBindingFile,
} from './handoff.mjs';
import {assertSpecUnchanged} from './spec.mjs';
import {engineOf, leakScan} from './support.mjs';

import {readSchema} from '../../../schemas/validator.mjs';
import {buildTask} from '../agents.mjs';
import {EXIT, ORCH_VERIFIER_DIR, ORCH_REPO_PATH, readJson, sha256File} from '../common.mjs';
import {engineArgv} from '../engine.mjs';
import {localSchemaPath} from '../schemas.mjs';
import {releaseStackAndConfirm} from '../stages/stage0_target.mjs';
import {dirDigest} from '../stages/util.mjs';

const VERIFIER_SCHEMA = 'verifier-result.schema.json';
const BOOKMARK_CTL = 'explorer-proto/infra/scripts/bookmark_ctl.mjs';

const FORBIDDEN_ACTIONS = [
    'Editing, staging or committing any tracked file (the spec, the charter, gates, infra scripts, the orchestrator). You are read-only on tracked files.',
    'Running explore or emit (`cli.ts explore`, `cli.ts emit`), or any command that regenerates or edits the spec or its reports by hand.',
    'Using, pulling or starting any image other than the pinned release image and its pinned database image; the main-branch image is out of scope.',
    'Printing, writing, hashing or measuring MM_LICENSE or any credential, token, port, origin, bookmark id, channel id or storage-state file name.',
    'Running `docker compose config`, an unfiltered `docker inspect`, `docker exec ... env`, `env`, `printenv`, or `set -x` around the infra scripts.',
    'Patching a bookmark as anyone but the seeding admin who owns it (a non-owner patch recreates the bookmark with a new id).',
    'Re-running until green, softening a gate, or copying a value from this task into the result without running the command that produces it.',
];

const ALLOWED_COMMANDS = [
    'run_command:bash explorer-proto/infra/scripts/gate.sh --keep',
    'run_command:bash explorer-proto/infra/scripts/up.sh --session=bookmarks',
    'run_command:bash explorer-proto/infra/scripts/down.sh',
    'run_command:node explorer-proto/infra/scripts/verify_seed.mjs --session=bookmarks',
    'run_command:node explorer-proto/infra/scripts/bookmark_ctl.mjs read|patch',
    'run_command:node explorer-proto/src/cli.ts replay --session=bookmarks',
    'run_command:node explorer-proto/v2/gates/replay_judge.mjs --expect <file> <report>',
    'run_command:sha256sum, md5sum, git status, git diff (read-only)',
];

/** The result schema with its shared definitions inlined and no schema URLs, so the task text carries no URL. */
function inlineResultSchema(schema) {
    const common = readSchema('common').definitions;
    const walk = (node) => {
        if (Array.isArray(node)) {
            return node.map(walk);
        }
        if (node && typeof node === 'object') {
            if (typeof node.$ref === 'string') {
                const {pattern} = common[node.$ref.split('/').at(-1)];
                return {type: 'string', pattern};
            }
            return Object.fromEntries(
                Object.entries(node)
                    .filter(([key]) => key !== '$schema' && key !== '$id')
                    .map(([key, value]) => [key, walk(value)]),
            );
        }
        return node;
    };
    return walk(schema);
}

function dispatchContext({ctx, control, record, trace, setup, schema}) {
    const {flags} = ctx;
    const expectation = {
        control_fail: {
            mode: 'control-fail',
            expected_test: record.expectation.test_title,
            expected_failing_assertion_text: record.expectation.expected_failing_assertion_text,
            expected_message_fragments: record.expectation.message_fragments,
            must_pass_tests: [],
            expected_executions: 1,
        },
        pass: {
            mode: 'pass',
            expected_test: record.expectation.test_title,
            must_pass_tests: [record.expectation.test_title],
            expected_executions: 1,
        },
    };
    return {
        purpose:
            'Independently reproduce the baseline pass and the controlled failure of an existing spec, then the restored pass, on a clean fixture of your own.',
        spec: {path: flags.verifySpec.path, sha256: flags.verifySpec.sha256, test_title: record.expectation.test_title},
        assertion: {
            expected_failing_line: record.expectation.failing_line,
            expected_failing_expect_call: record.expectation.expected_failing_assertion_text,
            charter_text: control.entry.expected_failing_assertion,
            expected_step_count: record.expectation.expects_up_to_failing,
            only_one_error_expected: true,
        },
        control: {
            id: control.def.id,
            label: control.def.label,
            channel_key: control.def.channel,
            declared_title: control.declaredTitle,
            changed_title: control.def.changed_title,
            owner_patch_required: control.def.owner_patch_required,
            endpoint: control.def.endpoint,
            commands: {
                read: `node ${BOOKMARK_CTL} read --channel=${control.def.channel}`,
                apply: `node ${BOOKMARK_CTL} patch --channel=${control.def.channel} --title='${control.def.changed_title}'`,
                restore: `node ${BOOKMARK_CTL} patch --channel=${control.def.channel} --title='${control.declaredTitle}'`,
            },
            expected_effect: `the read-back shows exactly one bookmark titled "${control.def.changed_title}" on the same bookmark id; link target, type and channel are unchanged`,
        },
        failure_trace: trace,
        fixture: {
            session: flags.session,
            channel_keys: ['qa-sandbox', 'release-planning'],
            declared_bookmarks: control.charter.fixture_setup.bookmarks.map((b) => ({
                channel_key: b.channel,
                display_name: b.display_name,
            })),
            image_digest: setup.image_digest,
            retries: 0,
            workers: 1,
            licence_note: 'MM_LICENSE is exported in your environment. Never print, write, hash or measure it.',
            commands: {
                up: [
                    'bash explorer-proto/infra/scripts/gate.sh --keep',
                    'bash explorer-proto/infra/scripts/up.sh --session=bookmarks',
                ],
                seed_check: 'node explorer-proto/infra/scripts/verify_seed.mjs --session=bookmarks',
                replay: engineArgv('replay', engineOf(flags)).join(' '),
                replay_report: 'explorer-proto/sessions/bookmarks/generated/reports/replay.json',
                judge: 'node explorer-proto/v2/gates/replay_judge.mjs --expect <expectation.json> <replay_report>',
                down: 'bash explorer-proto/infra/scripts/down.sh',
            },
        },
        judge: {expectations: expectation},
        allowed: {
            tools: ['read_file', 'list_directory', 'search_repo_text', ...ALLOWED_COMMANDS],
            writes: ['the one result file named in output.result_file', 'scratch files outside tracked paths'],
        },
        forbidden_actions: FORBIDDEN_ACTIONS,
        result_notes: {
            judge_fields:
                'baseline_pass.judge, reproduced_failure.judge and restored.judge are the status printed by replay_judge.mjs (pass, fail or blocked): in pass mode for the baseline and the restored replay, in control-fail mode (context.judge.expectations.control_fail) for the reproduced failure.',
            step_evidence_summary:
                'One short entry per awaited expect in the spec, in order, up to and including the failing one: assertion.expected_step_count entries.',
            clean_fixture_confirmed:
                'true when you started your own stack with fixture.commands.up and verify_seed.mjs --session=bookmarks passed before the baseline replay.',
            id_same:
                'true when the bookmark id of the control channel is the same before the patch and after the restore. Compare in memory or by hash; never print an id.',
            readback: 'true when bookmark_ctl read shows exactly the declared title after the restore.',
            seed_check: 'true when verify_seed.mjs --session=bookmarks exits 0 after the restore.',
            only_one_error: 'true when the failing test recorded exactly one error.',
        },
        result_schema: inlineResultSchema(schema),
    };
}

/** Binding carried inside the task before it is hashed (process delivery). */
function bindingContext({flags, nonce, specSha, traceSha, record}) {
    return {
        run_id: flags.runId,
        dispatch_nonce: nonce,
        expected_spec_sha256: specSha,
        expected_trace_sha256: traceSha,
        expected_failing_line: record.expectation.failing_line,
        how_to_bind:
            'Compute the sha256 of this task file and of the trace file, compare the trace hash with expected_trace_sha256 and the spec hash with expected_spec_sha256, and echo run_id, task_id and dispatch_nonce in result.receipt together with the hashes you observed. Refuse (verdict blocked) on any mismatch.',
    };
}

function verifierHash() {
    const dir = ORCH_VERIFIER_DIR;
    if (!fs.existsSync(dir)) {
        return null;
    }
    return fs
        .readdirSync(dir)
        .sort()
        .map((f) => `${f}:${sha256File(path.join(dir, f))}`)
        .join(',');
}

function setAsideStaleResult(resultAbs) {
    if (!fs.existsSync(resultAbs)) {
        return null;
    }
    let n = 1;
    while (fs.existsSync(path.join(path.dirname(resultAbs), `agent-result.stale.${n}.json`))) {
        n += 1;
    }
    const stale = path.join(path.dirname(resultAbs), `agent-result.stale.${n}.json`);
    fs.renameSync(resultAbs, stale);
    return stale;
}

function processRecord({delivery, argv, names, spawned, scratchDir, postTeardown, resultAbs}) {
    let blocker = null;
    if (!spawned.spawned) {
        blocker = `the verifier process could not be started${spawned.error ? ` (${spawned.error})` : ''}`;
    } else if (spawned.timed_out) {
        blocker = `the verifier process exceeded its ${delivery.verifier.timeout_seconds}s time budget and was killed`;
    } else if (spawned.signal) {
        blocker = `the verifier process was killed by ${spawned.signal}`;
    } else if (!fs.existsSync(resultAbs)) {
        blocker = `the verifier process exited ${spawned.exit_code} without writing a result`;
    }
    return {
        schema: 'explorer-verifier-process/v1',
        run_id: delivery.run_id,
        task_id: delivery.task_id,
        dispatch_nonce: delivery.dispatch_nonce,
        kind: VERIFIER_KIND,
        spawned: spawned.spawned,
        pid: spawned.pid,
        argv,
        env_names: names,
        scratch_cwd: scratchDir !== null,
        exit_code: spawned.exit_code,
        signal: spawned.signal,
        timed_out: spawned.timed_out,
        elapsed_seconds: Number(spawned.elapsed_seconds.toFixed(3)),
        result_file_present: fs.existsSync(resultAbs),
        stdout_lines: spawned.stdout.length,
        stderr_lines: spawned.stderr.length,
        post_teardown: postTeardown,
        blocker,
    };
}

export default {
    index: 3,
    name: 'dispatch',
    ignoreOutput: (rel) => rel.startsWith('agent-result'),

    inputs(ctx) {
        return [
            {control: dirDigest(ctx, 2)},
            {spec: ctx.flags.verifySpec.sha256},
            {verifier: ctx.flags.verifier === 'process' ? verifierHash() : null},
        ];
    },

    async run(ctx) {
        const {flags} = ctx;
        const sha = assertSpecUnchanged(flags);
        if (!flags.live) {
            return {result: 'skipped', reason: 'skipped: not live (nothing was run, so there is nothing to dispatch)'};
        }
        const processMode = flags.verifier === 'process';
        const control = loadControl(flags.control.id, flags.session);
        const record = ctx.readJson(2, 'control.json', 'orch#control-record');
        const trace = ctx.readJson(2, 'failure-trace.json', 'orch#failure-trace');
        const status = ctx.readJson(0, 'status.json', 'orch#stage0-status');
        const setup = ctx.readJson(0, `attempt-${status.current_attempt}/setup.json`, 'orch#stage0-setup');
        const schema = readJson(localSchemaPath(VERIFIER_SCHEMA));
        const traceAbs = path.join(ctx.dirOf(2), 'failure-trace.json');
        thaw(traceAbs);
        const traceSha = sha256File(traceAbs);
        const nonce = processMode ? newNonce() : null;

        const resultRel = `${ctx.stageDirName}/agent-result.json`;
        const resultAbs = path.join(ctx.out, resultRel);
        if (processMode) {
            setAsideStaleResult(resultAbs);
        }
        const context = dispatchContext({ctx, control, record, trace, setup, schema});
        if (processMode) {
            context.binding = bindingContext({flags, nonce, specSha: sha, traceSha, record});
            context.result_notes.receipt =
                'Required: {run_id, task_id, dispatch_nonce, task_sha256_observed, trace_sha256_observed, verifier_pid_note, verifier_kind: "deterministic-process"}, copied from what you observed, never from this task.';
        }
        const task = buildTask(
            ctx,
            {
                role: 'independent-verifier',
                prompt: 'independent_verify.md',
                inputs: [
                    {path: flags.verifySpec.path, base: 'repo', purpose: 'the spec under verification (read-only)'},
                    {
                        path: 'explorer-proto/sessions/bookmarks/charter.json',
                        base: 'repo',
                        purpose: 'the session charter (read-only)',
                    },
                    {path: control.file, base: 'repo', purpose: 'the control definition'},
                    {
                        path: '2-control/failure-trace.json',
                        base: 'out',
                        purpose: "the orchestrator's sanitized failure trace",
                    },
                ],
                extraTools: ALLOWED_COMMANDS,
                context,
            },
            resultRel,
            {
                id: 'verifier',
                file: `${ORCH_REPO_PATH}/schemas/${VERIFIER_SCHEMA}`,
                base: 'repo',
                sha256: sha256File(localSchemaPath(VERIFIER_SCHEMA)),
            },
        );
        const taskAbs = path.join(ctx.dir, 'agent-task.json');
        thaw(taskAbs);
        ctx.writeJson('agent-task.json', task, 'orch#agent-task');
        const taskScan = leakScan([taskAbs], {allowSlugs: true});

        let delivery = null;
        if (processMode) {
            freezeReadOnly(taskAbs);
            freezeReadOnly(traceAbs);
            const timeoutSeconds = flags.verifierTimeout ?? DEFAULT_TIMEOUT_SECONDS;
            delivery = {
                mode: DELIVERY_MODE,
                run_id: flags.runId,
                task_id: task.task_id,
                dispatch_nonce: nonce,
                task_file: `${ctx.stageDirName}/agent-task.json`,
                trace_file: '2-control/failure-trace.json',
                task_sha256: sha256File(taskAbs),
                trace_sha256: sha256File(traceAbs),
                frozen_read_only: isFrozen(taskAbs) && isFrozen(traceAbs),
                expected: {
                    spec_sha256: sha,
                    failing_line: record.expectation.failing_line,
                    expect_call: record.expectation.expected_failing_assertion_text,
                    expects_up_to_failing: record.expectation.expects_up_to_failing,
                },
                verifier: {
                    kind: VERIFIER_KIND,
                    command: portableArgv(
                        verifierArgv({
                            task: taskAbs,
                            trace: traceAbs,
                            out: resultAbs,
                            nonceFile: path.join('<scratch>', 'dispatch-binding.json'),
                        }),
                        {run: ctx.out, scratch: '<scratch>'},
                    ),
                    timeout_seconds: timeoutSeconds,
                    env_policy: ENV_POLICY,
                },
            };
        }

        const teardown = releaseStackAndConfirm();
        ctx.writeJson(
            'dispatch.json',
            {
                schema: 'explorer-dispatch-record/v1',
                task_id: task.task_id,
                role: task.role,
                task_file: `${ctx.stageDirName}/agent-task.json`,
                result_file: resultRel,
                spec: {path: flags.verifySpec.path, sha256: sha},
                task_leak_scan: taskScan,
                teardown,
                ...(delivery ? {delivery} : {}),
            },
            'orch#dispatch-record',
        );
        if (taskScan.unsafe_text !== 'PASS' || taskScan.licence === 'FAIL') {
            return {result: 'fail', reason: 'the agent task did not pass the leak scan'};
        }
        if (!teardown.confirmed) {
            return {result: 'fail', reason: 'the stack is not confirmed down, so the verifier could not start clean'};
        }
        if (processMode) {
            return runVerifierProcess({ctx, delivery, taskAbs, traceAbs, resultAbs});
        }
        const halt = fs.existsSync(resultAbs) ? undefined : {exitCode: EXIT.AWAITING_AGENT, taskAbs, resultAbs};
        return {result: 'pass', reason: 'dispatched to the independent verifier; the stack is down', halt};
    },
};

async function runVerifierProcess({ctx, delivery, taskAbs, traceAbs, resultAbs}) {
    const scratch = makeScratchDir();
    try {
        const nonceFile = writeBindingFile(scratch, {
            run_id: delivery.run_id,
            task_id: delivery.task_id,
            dispatch_nonce: delivery.dispatch_nonce,
            task_sha256: delivery.task_sha256,
            trace_sha256: delivery.trace_sha256,
            spec_sha256: delivery.expected.spec_sha256,
        });
        const argv = verifierArgv({task: taskAbs, trace: traceAbs, out: resultAbs, nonceFile});
        const {env, names} = scrubbedEnv();
        process.stdout.write(`dispatch     starting the verifier process (${VERIFIER_SCRIPT.split('/').at(-1)})\n`);
        const spawned = await spawnVerifier({
            argv,
            cwd: scratch,
            env,
            timeoutSeconds: delivery.verifier.timeout_seconds,
        });
        const postTeardown = releaseStackAndConfirm();
        const rec = processRecord({
            delivery,
            argv,
            names,
            spawned,
            scratchDir: scratch,
            postTeardown,
            resultAbs,
        });
        ctx.writeJson('process.json', rec, 'orch#process-record');
        const shape = `verifier process exit ${spawned.exit_code ?? 'none'} after ${spawned.elapsed_seconds.toFixed(1)}s`;
        if (!postTeardown.confirmed) {
            return {result: 'fail', reason: `${shape}; the stack is not confirmed down afterwards`};
        }
        return {result: 'pass', reason: rec.blocker ? `${shape}; ${rec.blocker}` : shape};
    } finally {
        fs.rmSync(scratch, {recursive: true, force: true});
    }
}
