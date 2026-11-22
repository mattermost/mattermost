#!/usr/bin/env node
// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable @stylistic/indent, @stylistic/multiline-ternary, @stylistic/operator-linebreak, @stylistic/wrap-regex, no-process-env -- Prettier owns formatting and the repo config relaxes these rules for .ts/.js only; the verifier passes MM_LICENSE only to the infra scripts that start the stack */

// The deterministic verifier of an existing spec under a verification control (no model, no vision call). It is started
// by the coordinator as a separate OS process and is given artifact paths only:
//   node bookmarks_verifier.mjs --task <agent-task.json> --trace <failure-trace.json> --out <agent-result.json>
//                               --nonce-file <dispatch-binding.json>
// It reads those files, nothing else under the run directory, and never the coordinator's records. It first proves the
// inputs are byte-exact (hashes bound to the dispatch, the nonce inside the task, the spec on disk); on any mismatch it
// writes a `blocked` result and exits 3. Then it brings up its own clean fixture, replays the unchanged spec, applies
// the control with the owner patch, replays again, restores, replays a third time, tears its stack down and writes a
// result bound to the dispatch by a receipt. Exit: 0 pass, 1 fail, 3 blocked.
import {spawnSync} from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

import {judge, normalizeCall} from '../../gates/replay_judge.mjs';
import {splitCommand} from '../../gates/mutation_control.mjs';
import {canonicalJson, PROTO_DIR, REPO_ROOT, sha256File} from '../lib/common.mjs';
import {infraPaths} from '../lib/infra.mjs';
import {validate} from '../lib/schemas.mjs';
import {checkManifestSession, probeFixture, readManifest} from '../lib/verify/fixture.mjs';
import {failureEvidence} from '../lib/verify/trace.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const STEP_REPORTER = path.join(HERE, 'step_reporter.mjs');
const ZERO_SHA = '0'.repeat(64);
const SAFE_TITLE = /^[A-Za-z0-9 ]+$/;
const EXPECTED_UP = [
    'bash explorer-proto/infra/scripts/gate.sh --keep',
    'bash explorer-proto/infra/scripts/up.sh --session=bookmarks',
];
const MINUTES = 60 * 1000;

const say = (line) => process.stdout.write(`verifier: ${line}\n`);

function parseFlags(argv) {
    const flags = {};
    for (let i = 0; i < argv.length; i++) {
        const m = /^--([a-z-]+)(?:=(.*))?$/.exec(argv[i]);
        if (m) {
            flags[m[1]] = m[2] ?? argv[++i];
        }
    }
    return flags;
}

const readBytes = (file) => (file && fs.existsSync(file) && fs.statSync(file).isFile() ? fs.readFileSync(file) : null);
const parseJson = (bytes) => {
    try {
        return bytes === null ? null : JSON.parse(bytes.toString('utf8'));
    } catch {
        return null;
    }
};
const sha = (bytes) => (bytes === null ? null : crypto.createHash('sha256').update(bytes).digest('hex'));

function writeResult(out, result) {
    const shape = validate('verifier', result);
    if (!shape.ok) {
        throw new Error(`internal: result invalid: ${shape.errors[0]}`);
    }
    fs.mkdirSync(path.dirname(out), {recursive: true});
    const tmp = `${out}.tmp-${process.pid}`;
    fs.writeFileSync(tmp, `${JSON.stringify(result, null, 2)}\n`);
    fs.renameSync(tmp, out);
}

/** The inputs, proven byte-exact against the binding file and each other. Returns {ok, reasons, ...facts}. */
function checkInputs(flags) {
    const reasons = [];
    const taskBytes = readBytes(flags.task);
    const traceBytes = readBytes(flags.trace);
    const bindingBytes = readBytes(flags['nonce-file']);
    const task = parseJson(taskBytes);
    const trace = parseJson(traceBytes);
    const binding = parseJson(bindingBytes);
    const facts = {
        task,
        trace,
        binding,
        taskSha: sha(taskBytes),
        traceSha: sha(traceBytes),
    };
    const need = (ok, reason) => {
        if (!ok) {
            reasons.push(reason);
        }
    };
    need(binding !== null, 'binding_file_missing_or_unreadable');
    need(taskBytes !== null && task !== null, 'task_missing_or_not_json');
    need(traceBytes !== null && trace !== null, 'trace_missing_or_not_json');
    if (binding && task && facts.taskSha) {
        const stamp = task.context?.binding;
        need(facts.taskSha === binding.task_sha256, 'task_bytes_differ_from_dispatched_hash');
        need(Boolean(stamp) && stamp.dispatch_nonce === binding.dispatch_nonce, 'task_nonce_differs_from_binding');
        need(Boolean(stamp) && stamp.run_id === binding.run_id, 'task_run_id_differs_from_binding');
        need(task.task_id === binding.task_id, 'task_id_differs_from_binding');
        need(task.role === 'independent-verifier', 'task_role_unexpected');
        if (facts.traceSha) {
            need(facts.traceSha === binding.trace_sha256, 'trace_bytes_differ_from_dispatched_hash');
            need(stamp?.expected_trace_sha256 === facts.traceSha, 'trace_bytes_differ_from_hash_in_task');
        }
        if (trace) {
            need(trace.spec?.sha256 === task.context?.spec?.sha256, 'trace_spec_hash_differs_from_task');
            need(
                canonicalJson(trace) === canonicalJson(task.context?.failure_trace ?? null),
                'trace_differs_from_trace_embedded_in_task',
            );
        }
        const specPath = task.context?.spec?.path;
        const safePath =
            typeof specPath === 'string' &&
            /^explorer-proto\/sessions\/[a-z0-9-]+\/generated\/[A-Za-z0-9_.-]+\.spec\.ts$/.test(specPath);
        need(safePath, 'spec_path_unexpected');
        if (safePath) {
            const onDisk = fs.existsSync(path.join(REPO_ROOT, specPath))
                ? sha256File(path.join(REPO_ROOT, specPath))
                : null;
            facts.specSha = onDisk;
            need(onDisk !== null && onDisk === task.context.spec.sha256, 'spec_on_disk_differs_from_task');
            need(binding.spec_sha256 === task.context.spec.sha256, 'spec_hash_differs_from_binding');
        }
    }
    return {ok: reasons.length === 0, reasons, ...facts};
}

function receiptOf(facts) {
    const stamp = facts.task?.context?.binding;
    return {
        run_id: facts.binding?.run_id ?? stamp?.run_id ?? 'unknown',
        task_id: facts.task?.task_id ?? facts.binding?.task_id ?? 'unreadable-task',
        dispatch_nonce: facts.binding?.dispatch_nonce ?? stamp?.dispatch_nonce ?? '0'.repeat(32),
        task_sha256_observed: facts.taskSha ?? null,
        trace_sha256_observed: facts.traceSha ?? null,
        verifier_pid_note: 'separate OS process started by the coordinator; the coordinator records its pid',
        verifier_kind: 'deterministic-process',
    };
}

function blockedResult(facts, reasons) {
    return {
        task_id: facts.task?.task_id ?? facts.binding?.task_id ?? 'unreadable-task',
        spec_sha256_observed: facts.specSha ?? ZERO_SHA,
        clean_fixture_confirmed: false,
        baseline_pass: null,
        control_applied: null,
        reproduced_failure: null,
        restored: null,
        verdict: 'blocked',
        notes: `refused to run: ${reasons.join(', ')}`.slice(0, 1400),
        receipt: receiptOf(facts),
    };
}

/** Command runner: no shell; the licence reaches only the scripts that start the stack. */
function runner() {
    const infra = infraPaths();
    const base = {...process.env};
    const noLicence = () => {
        const env = {...base};
        delete env.MM_LICENSE;
        return env;
    };
    const run = (argv, {licence = false, capture = false, env = {}, timeout = 5 * MINUTES} = {}) => {
        const r = spawnSync(argv[0], argv.slice(1), {
            cwd: REPO_ROOT,
            env: {...(licence ? base : noLicence()), ...env},
            encoding: 'utf8',
            timeout,
            killSignal: 'SIGKILL',
            stdio: ['ignore', capture ? 'pipe' : 'ignore', 'ignore'],
            maxBuffer: 16 * 1024 * 1024,
        });
        return {status: r.status ?? 1, stdout: capture ? (r.stdout ?? '') : ''};
    };
    return {infra, run};
}

const callOf = (line) =>
    String(line ?? '')
        .trim()
        .replace(/\s*\/\/.*$/, '');

function readSteps(file) {
    const rows = parseJson(readBytes(file));
    return Array.isArray(rows) ? rows : [];
}

function replayOnce({tools, scratch, label, expectation, titles}) {
    const seam = process.env.PILOT_REPLAY_CMD;
    const report =
        process.env.PILOT_REPLAY_REPORT ??
        path.join(PROTO_DIR, 'sessions', 'bookmarks', 'generated', 'reports', 'replay.json');
    const stepsFile = path.join(scratch, `steps-${label}.json`);
    fs.rmSync(report, {force: true});
    fs.rmSync(stepsFile, {force: true});
    const engine = seam ? splitCommand(seam) : ['node', 'explorer-proto/src/cli.ts', 'replay', '--session=bookmarks'];
    const done = tools.run([...engine, '--', `--reporter=list,json,${STEP_REPORTER}`], {
        env: {PLAYWRIGHT_JSON_OUTPUT_NAME: report, PILOT_STEP_OUT: stepsFile},
    });
    const judged = judge({reports: fs.existsSync(report) ? [report] : [], expectation});
    let configOk = false;
    let parsed = null;
    if (fs.existsSync(report)) {
        parsed = parseJson(readBytes(report));
        const retries = Math.max(0, ...(parsed?.config?.projects ?? []).map((p) => Number(p.retries) || 0));
        configOk = retries === 0 && Number(parsed?.config?.workers) === 1;
    }
    const evidence =
        expectation.mode === 'control-fail' && parsed
            ? failureEvidence({
                  report: parsed,
                  title: expectation.expected_test,
                  resultsRoot: path.join(PROTO_DIR, 'sessions', 'bookmarks', 'generated', 'test-results'),
                  titles,
              })
            : null;
    return {
        exit: done.status,
        judge: judged.status,
        observed: judged.observed,
        configOk,
        evidence,
        steps: readSteps(stepsFile),
    };
}

function stepEvidence(steps, failingLine, expectedCount) {
    const failedAt = steps.findIndex((s) => s.error);
    const considered = failedAt >= 0 ? steps.slice(0, failedAt + 1) : [];
    const summary = considered.map(
        (s, i) => `expect ${i + 1} at line ${s.line} ${s.matcher} ${s.error ? 'failed' : 'passed'}`,
    );
    const ok =
        considered.length === expectedCount &&
        considered.at(-1)?.line === failingLine &&
        considered.slice(0, -1).every((s) => !s.error);
    return {summary: summary.length > 0 ? summary : ['no expect step was recorded'], ok};
}

async function verifyOnFixture({task, tools, scratch, specLines}) {
    const {infra, run} = tools;
    const ctl = task.context.control;
    const fixture = task.context.fixture;
    const channel = ctl.channel_key;
    const declaredTitle = ctl.declared_title;
    const changedTitle = ctl.changed_title;
    const declared = fixture.declared_bookmarks.map((b) => ({channel: b.channel_key, display_name: b.display_name}));
    const allTitles = [declaredTitle, changedTitle, ...declared.map((d) => d.display_name)];
    const judgeSpec = task.context.judge.expectations;
    const expected = task.context.assertion;
    const trace = task.context.failure_trace;
    const notes = [];
    const out = {specObserved: task.context.spec.sha256};

    const specSha = () => sha256File(path.join(REPO_ROOT, task.context.spec.path));
    out.specObserved = specSha();

    const upOk =
        fixture.commands.up.every((c, i) => c === EXPECTED_UP[i]) && fixture.commands.up.length === EXPECTED_UP.length;
    if (
        !upOk ||
        ctl.owner_patch_required !== true ||
        !SAFE_TITLE.test(declaredTitle) ||
        !SAFE_TITLE.test(changedTitle) ||
        !/^[a-z0-9-]+$/.test(channel)
    ) {
        return {...out, blocked: 'the task carries commands or control values the verifier does not accept'};
    }

    let stackStarted = false;
    try {
        const gate = run(['bash', infra.gate, '--keep'], {licence: true, capture: true, timeout: 10 * MINUTES});
        stackStarted = true;
        if (gate.status !== 0 || !/GATE:\s*PASS/.test(gate.stdout) || !/IsLicensed[^\n]*\bPASS\b/.test(gate.stdout)) {
            return {...out, blocked: `isolation and licence gate failed (exit ${gate.status}); a setup failure`};
        }
        const up = run(['bash', infra.up, '--session=bookmarks'], {licence: true, timeout: 10 * MINUTES});
        if (up.status !== 0) {
            return {...out, blocked: `up.sh did not bring the stack up (exit ${up.status})`};
        }
        say('own stack up, licence gate PASS');
        const manifest = readManifest();
        const check = checkManifestSession(manifest, 'bookmarks', declared);
        const before = check.ok ? await probeFixture({manifest, declared}) : {ok: false, fingerprint: null};
        const seedEnv = manifest?.base_url ? {PW_BASE_URL: manifest.base_url} : {};
        const seed = run(['node', path.join(infra.scripts, 'verify_seed.mjs'), '--session=bookmarks'], {env: seedEnv});
        out.clean = check.ok && before.ok && seed.status === 0;
        say(`clean fixture ${out.clean ? 'PASS' : 'FAIL'}`);
        if (!out.clean) {
            return {
                ...out,
                blocked: 'the fixture was not clean before the baseline (manifest, probe or seed check failed)',
            };
        }
        const ctlRun = (...args) =>
            run(['node', infra.bookmarkCtl, ...args], {capture: true, env: seedEnv, timeout: MINUTES});
        const titleNow = () => parseJson(Buffer.from(ctlRun('read', `--channel=${channel}`).stdout));
        const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

        out.baseline = replayOnce({tools, scratch, label: 'baseline', expectation: judgeSpec.pass, titles: allTitles});
        out.specObserved = specSha();
        say(`baseline replay exit ${out.baseline.exit}, judge ${out.baseline.judge}`);

        if (!same(titleNow(), [declaredTitle])) {
            return {...out, blocked: 'the control channel does not show the declared title before the control'};
        }
        try {
            const patch = ctlRun('patch', `--channel=${channel}`, `--title=${changedTitle}`);
            const patched = patch.status === 0 && /^PASS/.test(patch.stdout);
            const readback = same(titleNow(), [changedTitle]);
            const mutated = await probeFixture({manifest, declared, titles: {[channel]: changedTitle}});
            const sameId = mutated.ok && mutated.fingerprint === before.fingerprint;
            out.control = {accepted: patched && readback && sameId};
            say(`control applied ${out.control.accepted ? 'PASS' : 'FAIL'} (owner patch, in place)`);
            if (out.control.accepted) {
                out.failure = replayOnce({
                    tools,
                    scratch,
                    label: 'control',
                    expectation: judgeSpec.control_fail,
                    titles: allTitles,
                });
                say(`control replay exit ${out.failure.exit}, judge ${out.failure.judge}`);
            }
        } finally {
            const restore = ctlRun('patch', `--channel=${channel}`, `--title=${declaredTitle}`);
            const restoredBack = same(titleNow(), [declaredTitle]);
            const after = await probeFixture({manifest, declared});
            const seedAfter = run(['node', path.join(infra.scripts, 'verify_seed.mjs'), '--session=bookmarks'], {
                env: seedEnv,
            });
            out.restored = {
                readback: restoredBack && restore.status === 0,
                id_same: after.ok && after.fingerprint === before.fingerprint,
                seed_check: seedAfter.status === 0,
            };
        }
        out.restoredReplay = replayOnce({
            tools,
            scratch,
            label: 'restored',
            expectation: judgeSpec.pass,
            titles: allTitles,
        });
        out.specAfter = specSha();
        say(`restored replay exit ${out.restoredReplay.exit}, judge ${out.restoredReplay.judge}`);

        const failure = out.failure;
        if (failure?.evidence) {
            const line = failure.evidence.line;
            out.failureFacts = {
                failing_line: line,
                expect_call: callOf(specLines[line - 1]),
                message_first_line: failure.evidence.message_first_line,
                only_one_error: failure.evidence.error_count === 1,
                steps: stepEvidence(failure.steps, expected.expected_failing_line, expected.expected_step_count),
            };
        }
        out.traceFirstLine = trace.message_first_line;
    } finally {
        if (stackStarted) {
            const down = run(['bash', infra.down], {timeout: 5 * MINUTES});
            notes.push(`own stack teardown exit ${down.status}`);
            say(`own stack teardown exit ${down.status}`);
        }
    }
    return {...out, notes};
}

function buildResult({task, facts, found}) {
    const expected = task.context.assertion;
    const trace = task.context.failure_trace;
    const specSha = task.context.spec.sha256;
    const base = {
        task_id: task.task_id,
        spec_sha256_observed: found.specObserved ?? specSha,
        receipt: receiptOf(facts),
    };
    if (found.blocked || !found.baseline || !found.control || !found.restoredReplay || !found.failureFacts) {
        let why = 'the verifier could not complete its runs';
        if (found.control && !found.control.accepted) {
            why = 'the control was not accepted by the fixture (owner patch, read-back or id check); restored';
        } else if (found.control && !found.failureFacts) {
            why = `the replay under the control recorded no failing test (judge ${found.failure?.judge})`;
        }
        return {
            ...base,
            clean_fixture_confirmed: Boolean(found.clean),
            baseline_pass: null,
            control_applied: null,
            reproduced_failure: null,
            restored: null,
            verdict: 'blocked',
            notes: String(found.blocked ?? why).slice(0, 1400),
        };
    }
    const failure = found.failureFacts;
    const baselinePassed = found.baseline.exit === 0 && found.baseline.judge === 'pass' && found.baseline.configOk;
    const reproduced = {
        failing_line: failure.failing_line,
        expect_call: failure.expect_call,
        message_first_line: failure.message_first_line,
        only_one_error: failure.only_one_error,
        step_evidence_summary: failure.steps.summary,
        judge: found.failure.judge,
    };
    const restoredPassed =
        found.restoredReplay.exit === 0 && found.restoredReplay.judge === 'pass' && found.restoredReplay.configOk;
    const restored = {
        readback: found.restored.readback,
        id_same: found.restored.id_same,
        seed_check: found.restored.seed_check,
        replay_pass: restoredPassed,
        judge: found.restoredReplay.judge,
        spec_sha_after: found.specAfter ?? specSha,
    };
    const good =
        found.clean === true &&
        baselinePassed &&
        reproduced.judge === 'pass' &&
        reproduced.only_one_error &&
        reproduced.failing_line === expected.expected_failing_line &&
        normalizeCall(reproduced.expect_call) === normalizeCall(expected.expected_failing_expect_call) &&
        reproduced.message_first_line === trace.message_first_line &&
        failure.steps.ok &&
        restored.readback &&
        restored.id_same &&
        restored.seed_check &&
        restored.replay_pass &&
        restored.judge === 'pass' &&
        found.specObserved === specSha &&
        restored.spec_sha_after === specSha;
    const verdict = good ? 'pass' : 'fail';
    const notes = [
        'Deterministic verifier (no model): own clean fixture, engine replay with a step reporter added, owner patch via bookmark_ctl.',
        ...(found.notes ?? []),
    ].join(' ');
    return {
        ...base,
        clean_fixture_confirmed: found.clean === true,
        baseline_pass: {exit: found.baseline.exit, passed: baselinePassed, judge: found.baseline.judge},
        control_applied: {
            accepted: true,
            fields_changed_summary:
                'display_name only; owner patch, same bookmark id (fingerprint equal after the patch)',
        },
        reproduced_failure: reproduced,
        restored,
        verdict,
        notes: notes.slice(0, 1400),
    };
}

async function main() {
    const flags = parseFlags(process.argv.slice(2));
    if (!flags.task || !flags.trace || !flags.out || !flags['nonce-file']) {
        process.stderr.write(
            'usage: bookmarks_verifier.mjs --task <file> --trace <file> --out <file> --nonce-file <file>\n',
        );
        return 2;
    }
    const out = path.resolve(flags.out);
    const facts = checkInputs({
        task: path.resolve(flags.task),
        trace: path.resolve(flags.trace),
        'nonce-file': path.resolve(flags['nonce-file']),
    });
    if (!facts.ok) {
        writeResult(out, blockedResult(facts, facts.reasons));
        say(`refused: ${facts.reasons.join(', ')}`);
        return 3;
    }
    say('inputs are byte-exact (hashes, nonce, spec)');
    const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'pilot-verifier-steps-'));
    let result;
    try {
        const specLines = fs.readFileSync(path.join(REPO_ROOT, facts.task.context.spec.path), 'utf8').split('\n');
        const found = await verifyOnFixture({task: facts.task, tools: runner(), scratch, specLines});
        result = buildResult({task: facts.task, facts, found});
    } catch (e) {
        result = blockedResult(facts, [`internal_error:${String(e.message).replace(/\s+/g, ' ').slice(0, 120)}`]);
    } finally {
        fs.rmSync(scratch, {recursive: true, force: true});
    }
    writeResult(out, result);
    say(`verdict ${result.verdict}`);
    return {pass: 0, fail: 1, blocked: 3}[result.verdict];
}

process.exitCode = await main();
