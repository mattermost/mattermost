#!/usr/bin/env node
// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable @stylistic/indent, @stylistic/wrap-regex -- Prettier owns formatting and the repo config relaxes these rules for .ts/.js only */

// The v2 pipeline as a program. See README.md.
//   pilot run --target <release|main> --feature <id> [--mode explore|author|both] [--out <dir>]
//             [--from <stage>] [--to <stage>] [--dry-run | --live] [--agents manual|stub[:scenario]|cmd:<template>]
//             [--resume] [--force] [--budget <stage>.<time|agent_calls|retries>=<n>] ...
//   pilot run --target release --live --run-id <id> --verify-spec <repo path> --engine-charter session:<name>
//             --control <id> [--agents manual]      (verify an existing spec; see README.md)
//   pilot lesson apply <lesson.json>
//   pilot features | stages
import fs from 'node:fs';
import path from 'node:path';

import {
    EXIT,
    MODES,
    ORCH_DIR,
    ORCH_RUNS_DIR,
    parseArgs,
    readJson,
    sha256Json,
    STAGE_NAMES,
    STAGE_SETS,
} from './lib/common.mjs';
import {listFeatures} from './lib/feature.mjs';
import {INFRA_SESSIONS} from './lib/infra.mjs';
import {assessLesson} from './lib/lessons_gate.mjs';
import {runPipeline} from './lib/pipeline.mjs';
import {validate} from './lib/schemas.mjs';
import {imagePin} from './lib/stages/stage0_target.mjs';
import {loadControl} from './lib/verify/control_def.mjs';
import {loadCharter} from './lib/verify/fixture.mjs';
import {resolveSpec} from './lib/verify/spec.mjs';

const USAGE = `usage:
  pilot.mjs run --target <release|main> --feature <id> [--mode explore|author|both] [--out <dir>]
                [--from <stage>] [--to <stage>] [--dry-run | --live] [--agents manual|stub[:scenario]|cmd:<template>]
                [--resume] [--force] [--keep-stack] [--budget <stage>.<time|agent_calls|retries>=<n>]...
                [--oracle-results <dir>] [--explore-cmd <command>] [--explore-repeat <n>] [--repeat <n>]
                [--engine-charter <session|journey>:<name>] [--session <name>] [--result <bakeoff result file>]
                [--run-id <id>]
  pilot.mjs run --target release --live --run-id <id> --verify-spec <repo-relative spec> --control <id>
                --engine-charter session:<name> [--agents manual|cmd:<template>] [--resume] [--keep-stack]
  pilot.mjs lesson apply <lesson.json>
  pilot.mjs features | stages
exit codes: 0 ok, 1 stage failed, 2 usage, 3 blocked, 20 awaiting agent, 21 agent result invalid, 22 agent command failed
`;

const BOOLEANS = ['dry-run', 'live', 'resume', 'force', 'keep-stack', 'help'];

function stageIndex(value, fallback, names = STAGE_NAMES) {
    if (value === undefined) {
        return fallback;
    }
    const byName = names.indexOf(
        String(value)
            .replace(/^[0-9]-/, '')
            .replace(/^verify$/, 'dispatch'),
    );
    const byNumber = /^[0-9]$/.test(String(value)) ? Number(value) : -1;
    return byNumber >= 0 ? byNumber : byName;
}

function usageError(message) {
    process.stderr.write(`${message}\n${USAGE}`);
    return EXIT.USAGE;
}

async function runCommand(argv) {
    let flags;
    try {
        ({flags} = parseArgs(argv, {booleans: BOOLEANS, repeatable: ['budget']}));
    } catch (e) {
        return usageError(e.message);
    }
    if (flags.help) {
        process.stdout.write(USAGE);
        return EXIT.OK;
    }
    if (flags['run-id'] !== undefined && !/^[a-z0-9][a-z0-9-]{0,60}$/.test(String(flags['run-id']))) {
        return usageError('--run-id must be lowercase letters, digits and hyphens, at most 61 characters');
    }
    let explicitOut = flags.out ? path.resolve(flags.out) : null;
    if (!explicitOut && flags['run-id']) {
        explicitOut = path.join(ORCH_RUNS_DIR, flags['run-id']);
    }
    const resumeFile = (out) => path.join(out, 'run.json');
    let saved = {};
    if (flags.resume) {
        if (!explicitOut || !fs.existsSync(resumeFile(explicitOut))) {
            return usageError('--resume needs --out or --run-id pointing at an earlier run (it holds run.json)');
        }
        saved = readJson(resumeFile(explicitOut));
    }
    const runId = flags['run-id'] ?? saved.run_id;
    const target = flags.target ?? saved.target;
    const verifying = flags['verify-spec'] !== undefined || saved.verify_spec !== undefined;
    const feature = flags.feature ?? saved.feature ?? (verifying ? null : undefined);
    const mode = verifying ? 'author' : (flags.mode ?? saved.mode ?? 'both');
    if (!['release', 'main'].includes(target)) {
        return usageError('--target must be release or main');
    }
    if (!feature && !verifying) {
        return usageError(`--feature is required; available: ${listFeatures().join(', ')}`);
    }
    if (!MODES.includes(mode)) {
        return usageError(`--mode must be one of ${MODES.join(', ')}`);
    }
    if (flags.live && flags['dry-run']) {
        return usageError('--live and --dry-run exclude each other');
    }
    const stageSet = verifying ? STAGE_SETS.verify_spec : STAGE_SETS.pipeline;
    const from = stageIndex(flags.from, 0, stageSet.names);
    const to = stageIndex(flags.to, stageSet.names.length - 1, stageSet.names);
    if (from < 0 || to < 0 || from > to) {
        return usageError(
            `--from and --to must name stages between 0 and ${stageSet.names.length - 1} (${stageSet.names.join(', ')}), from <= to`,
        );
    }
    const engineCharter = flags['engine-charter'] ?? saved.engine_charter;
    if (engineCharter !== undefined && !/^(?:session|journey):[a-z0-9-]+$/.test(engineCharter)) {
        return usageError('--engine-charter must look like session:<name> or journey:<name>');
    }
    let session;
    try {
        session = sessionFor(flags.session ?? saved.session, engineCharter);
    } catch (e) {
        return usageError(e.message);
    }
    const live = Boolean(flags.live) || (!flags['dry-run'] && saved.live === true);
    if (verifying && saved.live === true && !live) {
        return usageError('--dry-run cannot re-plan a run that was started live');
    }
    const out = explicitOut ?? path.join(ORCH_DIR, '.runs', `${target}-${feature}`);
    const toNumber = (v, name) => {
        if (v === undefined) {
            return undefined;
        }
        if (!/^[1-9][0-9]*$/.test(String(v))) {
            throw new Error(`${name} must be a positive integer`);
        }
        return Number(v);
    };
    let verify = {};
    if (verifying) {
        try {
            verify = verifyInputs({flags, saved, target, engineCharter, session, runId, out});
        } catch (e) {
            return usageError(e.message);
        }
    }
    try {
        return await runPipeline({
            target,
            feature: verifying ? verify.feature : feature,
            mode,
            live,
            out,
            from,
            to,
            agents: flags.agents ?? saved.agents ?? 'manual',
            force: Boolean(flags.force),
            keepStack: Boolean(flags['keep-stack']),
            budget: flags.budget ?? [],
            oracleResults: flags['oracle-results'],
            exploreCmd: flags['explore-cmd'],
            exploreRepeat: toNumber(flags['explore-repeat'], '--explore-repeat'),
            repeat: toNumber(flags.repeat, '--repeat'),
            engineCharter,
            session,
            runId: verifying ? runId : undefined,
            verifySpec: verify.verifySpec,
            control: verify.control,
            inputsFingerprint: verify.inputsFingerprint,
            resultFile: flags.result ? path.resolve(flags.result) : undefined,
            argCount: argv.length,
        });
    } catch (e) {
        process.stderr.write(`pilot: ${String(e.message).slice(0, 400)}\n`);
        return EXIT.FAIL;
    }
}

/** The session stage 0 seeds: an explicit --session, else the session of --engine-charter (when infra can seed it). */
function sessionFor(explicit, engineCharter) {
    const derived = engineCharter?.startsWith('session:') ? engineCharter.slice('session:'.length) : null;
    if (explicit === undefined) {
        return derived && INFRA_SESSIONS.includes(derived) ? derived : null;
    }
    if (!INFRA_SESSIONS.includes(explicit)) {
        throw new Error(`--session must be one of ${INFRA_SESSIONS.join(', ')} (the sessions infra/up.sh can seed)`);
    }
    if (derived && derived !== explicit) {
        throw new Error('--session and --engine-charter name different sessions');
    }
    return explicit;
}

/** Validates the verify-spec flags and returns the records the pipeline keeps in run.json. Throws a usage message. */
function verifyInputs({flags, saved, target, engineCharter, session, runId, out}) {
    if (target !== 'release') {
        throw new Error('--verify-spec runs on the pinned release target (--target release)');
    }
    if (!runId) {
        throw new Error('--verify-spec needs --run-id');
    }
    if (!session) {
        throw new Error('--verify-spec needs --engine-charter session:<name> naming a session infra can seed');
    }
    if (engineCharter !== `session:${session}`) {
        throw new Error('--verify-spec needs --engine-charter session:<name>');
    }
    const specPath = flags['verify-spec'] ?? saved.verify_spec?.path;
    if (flags['verify-spec'] && saved.verify_spec && flags['verify-spec'] !== saved.verify_spec.path) {
        throw new Error('--verify-spec differs from the spec recorded for this run');
    }
    const controlId = flags.control ?? saved.control?.id;
    if (!controlId) {
        throw new Error('--verify-spec needs --control <negative control id>');
    }
    if (flags.control && saved.control && flags.control !== saved.control.id) {
        throw new Error('--control differs from the control recorded for this run');
    }
    const resolved = resolveSpec(specPath, session);
    const control = loadControl(controlId, session);
    const verifySpec = {path: resolved.path, sha256: saved.verify_spec?.sha256 ?? resolved.sha256};
    const controlRecord = {id: controlId, file: control.file, sha256: saved.control?.sha256 ?? control.sha256};
    const inputsFingerprint = sha256Json({
        target,
        session,
        engine_charter: engineCharter,
        verify_spec: verifySpec,
        control: controlRecord,
        image_pin: imagePin(target),
    });
    const existing = path.join(out, 'run.json');
    if (!flags.resume && fs.existsSync(existing)) {
        const previous = readJson(existing);
        if (previous.inputs_fingerprint !== undefined && previous.inputs_fingerprint !== inputsFingerprint) {
            throw new Error(
                `run ${runId} already exists with different inputs (spec hash, control, session or image pin); use a new --run-id`,
            );
        }
        if (previous.inputs_fingerprint === undefined) {
            throw new Error(`run ${runId} already exists and is not a verify-spec run; use a new --run-id`);
        }
    }
    return {
        feature: loadCharter(session).feature_id,
        verifySpec,
        control: controlRecord,
        inputsFingerprint,
    };
}

function lessonCommand(argv) {
    const [verb, file] = argv;
    if (verb !== 'apply' || !file) {
        return usageError('usage: pilot.mjs lesson apply <lesson.json>');
    }
    let lesson;
    try {
        lesson = readJson(file);
    } catch {
        return usageError(`cannot read ${file} as JSON`);
    }
    const shape = validate('lesson', lesson);
    if (!shape.ok) {
        process.stdout.write(`REFUSED invalid lesson: ${shape.errors.join('; ')}\n`);
        return EXIT.FAIL;
    }
    const verdict = assessLesson(lesson);
    if (verdict.decision === 'refused_needs_human_approval') {
        process.stdout.write(`REFUSED ${lesson.id}: ${verdict.reason}\n`);
        return EXIT.FAIL;
    }
    process.stdout.write(
        `ELIGIBLE ${lesson.id}: ${verdict.reason}. The orchestrator edits no file; make the change as a normal reviewed change.\n`,
    );
    return EXIT.OK;
}

async function main(argv) {
    const [command, ...rest] = argv;
    switch (command) {
        case 'run':
            return runCommand(rest);
        case 'lesson':
            return lessonCommand(rest);
        case 'features':
            process.stdout.write(`${listFeatures().join('\n')}\n`);
            return EXIT.OK;
        case 'stages':
            process.stdout.write(`${STAGE_NAMES.map((n, i) => `${i} ${n}`).join('\n')}\n`);
            return EXIT.OK;
        default:
            return usageError(command ? `unknown command ${command}` : 'a command is required');
    }
}

process.exitCode = await main(process.argv.slice(2));
