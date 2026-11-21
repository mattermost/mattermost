#!/usr/bin/env node
// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable @stylistic/indent, @stylistic/wrap-regex -- Prettier owns formatting and the repo config relaxes these rules for .ts/.js only */

// The v2 pipeline as a program. See README.md.
//   pilot run --target <release|main> --feature <id> [--mode explore|author|both] [--out <dir>]
//             [--from <stage>] [--to <stage>] [--dry-run | --live] [--agents manual|stub[:scenario]|cmd:<template>]
//             [--resume] [--force] [--budget <stage>.<time|agent_calls|retries>=<n>] ...
//   pilot lesson apply <lesson.json>
//   pilot features | stages
import fs from 'node:fs';
import path from 'node:path';

import {EXIT, MODES, ORCH_DIR, parseArgs, readJson, STAGE_NAMES} from './lib/common.mjs';
import {listFeatures} from './lib/feature.mjs';
import {assessLesson} from './lib/lessons_gate.mjs';
import {runPipeline} from './lib/pipeline.mjs';
import {validate} from './lib/schemas.mjs';

const USAGE = `usage:
  pilot.mjs run --target <release|main> --feature <id> [--mode explore|author|both] [--out <dir>]
                [--from <stage>] [--to <stage>] [--dry-run | --live] [--agents manual|stub[:scenario]|cmd:<template>]
                [--resume] [--force] [--keep-stack] [--budget <stage>.<time|agent_calls|retries>=<n>]...
                [--oracle-results <dir>] [--explore-cmd <command>] [--explore-repeat <n>] [--repeat <n>]
                [--engine-charter <session|journey>:<name>] [--result <bakeoff result file>]
  pilot.mjs lesson apply <lesson.json>
  pilot.mjs features | stages
exit codes: 0 ok, 1 stage failed, 2 usage, 3 blocked, 20 awaiting agent, 21 agent result invalid, 22 agent command failed
`;

const BOOLEANS = ['dry-run', 'live', 'resume', 'force', 'keep-stack', 'help'];

function stageIndex(value, fallback) {
    if (value === undefined) {
        return fallback;
    }
    const byName = STAGE_NAMES.indexOf(String(value).replace(/^[0-9]-/, ''));
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
    const resumeFile = (out) => path.join(out, 'run.json');
    let saved = {};
    if (flags.resume) {
        if (!flags.out || !fs.existsSync(resumeFile(flags.out))) {
            return usageError('--resume needs --out pointing at an earlier run (it holds run.json)');
        }
        saved = readJson(resumeFile(flags.out));
    }
    const target = flags.target ?? saved.target;
    const feature = flags.feature ?? saved.feature;
    const mode = flags.mode ?? saved.mode ?? 'both';
    if (!['release', 'main'].includes(target)) {
        return usageError('--target must be release or main');
    }
    if (!feature) {
        return usageError(`--feature is required; available: ${listFeatures().join(', ')}`);
    }
    if (!MODES.includes(mode)) {
        return usageError(`--mode must be one of ${MODES.join(', ')}`);
    }
    if (flags.live && flags['dry-run']) {
        return usageError('--live and --dry-run exclude each other');
    }
    const from = stageIndex(flags.from, 0);
    const to = stageIndex(flags.to, STAGE_NAMES.length - 1);
    if (from < 0 || to < 0 || from > to) {
        return usageError(`--from and --to must name stages between 0 and 9 (${STAGE_NAMES.join(', ')}), from <= to`);
    }
    if (flags['engine-charter'] !== undefined && !/^(?:session|journey):[a-z0-9-]+$/.test(flags['engine-charter'])) {
        return usageError('--engine-charter must look like session:<name> or journey:<name>');
    }
    const live = Boolean(flags.live) || (!flags['dry-run'] && saved.live === true);
    const out = flags.out ? path.resolve(flags.out) : path.join(ORCH_DIR, '.runs', `${target}-${feature}`);
    const toNumber = (v, name) => {
        if (v === undefined) {
            return undefined;
        }
        if (!/^[1-9][0-9]*$/.test(String(v))) {
            throw new Error(`${name} must be a positive integer`);
        }
        return Number(v);
    };
    try {
        return await runPipeline({
            target,
            feature,
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
            engineCharter: flags['engine-charter'],
            resultFile: flags.result ? path.resolve(flags.result) : undefined,
            argCount: argv.length,
        });
    } catch (e) {
        process.stderr.write(`pilot: ${String(e.message).slice(0, 400)}\n`);
        return EXIT.FAIL;
    }
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
