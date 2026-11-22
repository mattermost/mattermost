#!/usr/bin/env node
// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Checks that the commands the workflow's scripts run against the coordinator match its documented contract: the flag
// list of "Headless CI entry" and "Usage" in explorer-proto/v2/orchestrator/README.md and what `pilot.mjs run --help`
// prints. The commands are the ones the scripts print under --dry-run, so they are the commands that would run.
// Exit 0 pass, 1 findings. Nothing is installed, pulled or started.
//   check_entry_contract.mjs [--root <repo>]
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {mapCoordinatorExit, ORCHESTRATOR_DEFAULT_VERIFIER_SECONDS} from './coordinator_plan.mjs';
import {COORDINATOR_TARGET_KINDS, EXIT, HERE, isMain, parseArgs, readJson, REPO_ROOT} from './lib.mjs';

const ORCH = 'explorer-proto/v2/orchestrator';
const SUBCOMMANDS = ['run', 'export', 'summary', 'doctor'];
// Flags that exist for the orchestrator's own tests or for people at a terminal; a workflow must not pass them.
const NOT_FOR_CI = ['dry-run', 'interrupt-after-stage', 'recover-fixture', 'resume', 'keep-stack', 'force', 'agents'];
const VALUE_PATTERNS = {
    image: [/^[^\s@]+@sha256:[0-9a-f]{64}$/, 'a reference with a sha256 digest'],
    target: [/^(release|main)$/, 'release or main'],
    'run-id': [/^[a-z0-9][a-z0-9-]{0,60}$/, 'lowercase letters, digits and hyphens, at most 61 characters'],
    'engine-charter': [/^(session|journey):[a-z0-9-]+$/, 'session:<name> or journey:<name>'],
    verifier: [/^(manual|process)$/, 'manual or process'],
    'verifier-timeout': [/^[1-9][0-9]*$/, 'a positive integer'],
};

function sectionOf(text, heading) {
    const start = text.indexOf(`\n## ${heading}\n`);
    if (start === -1) {
        return '';
    }
    const rest = text.slice(start + 1);
    const next = rest.indexOf('\n## ', 1);
    return next === -1 ? rest : rest.slice(0, next);
}

function flagsIn(text) {
    return [...text.matchAll(/(?<![\w-])--([a-z][a-z-]*)/g)].map((m) => m[1]);
}

/** Splits usage-style text into per-subcommand flag sets. Handles continuation lines and `a | summary ... | doctor`. */
export function flagsBySubcommand(text) {
    const result = Object.fromEntries(SUBCOMMANDS.map((name) => [name, new Set()]));
    let current = null;
    for (const raw of text.split('\n')) {
        const line = raw.replace(/\s#.*$/, '').replace(/\\$/, '');
        const start = /pilot\.mjs\s+(run|export|summary|doctor)\b/.exec(line);
        if (start) {
            current = start[1];
        } else if (line.trim() !== '' && !/^\s/.test(line)) {
            current = null;
        }
        if (!current) {
            continue;
        }
        let segmentCommand = current;
        const parts = line.split(/\s\|\s+(?=(?:run|export|summary|doctor)\b)/);
        for (const [index, part] of parts.entries()) {
            const lead = /^(?:.*pilot\.mjs\s+)?(run|export|summary|doctor)\b/.exec(part);
            if (index > 0 && lead) {
                segmentCommand = lead[1];
            }
            for (const flag of flagsIn(part)) {
                result[segmentCommand].add(flag);
            }
        }
        current = segmentCommand;
    }
    return result;
}

function flagTableRun(text) {
    const flags = new Set();
    for (const row of sectionOf(text, 'Usage').matchAll(/^\|\s*((?:`--[a-z-]+(?: <[^`]+>)?`(?:,\s*)?)+)\s*\|/gm)) {
        flagsIn(row[1]).forEach((flag) => flags.add(flag));
    }
    return flags;
}

export function parseReadme(readme) {
    const usage = flagsBySubcommand(sectionOf(readme, 'Usage'));
    const headless = flagsBySubcommand(sectionOf(readme, 'Headless CI entry'));
    const documented = Object.fromEntries(
        SUBCOMMANDS.map((name) => [name, new Set([...usage[name], ...headless[name]])]),
    );
    flagTableRun(readme).forEach((flag) => documented.run.add(flag));
    const codes = [...sectionOf(readme, 'Exit codes').matchAll(/^\|\s*(\d+)\s*\|/gm)].map((m) => Number(m[1]));
    return {documented, headlessRun: headless.run, codes};
}

/** The usage text `pilot.mjs run --help` prints. */
export function pilotUsage(root) {
    const r = spawnSync(process.execPath, [path.join(root, ORCH, 'pilot.mjs'), 'run', '--help'], {encoding: 'utf8'});
    if (r.status !== 0) {
        throw new Error(`pilot.mjs run --help exited ${r.status}`);
    }
    return r.stdout;
}

/** Command lines (`+ node <...>/pilot.mjs <sub> <args>`) -> {sub, flags: [{name, value}], line}. */
export function parseCommands(output) {
    const commands = [];
    for (const raw of output.split('\n')) {
        const tokens = raw
            .replace(/^\+\s+/, '')
            .replace(/\s>\s.*$/, '')
            .trim()
            .split(/\s+/);
        const at = tokens.findIndex((token) => token.endsWith('pilot.mjs'));
        if (at === -1 || !raw.startsWith('+ ')) {
            continue;
        }
        const [sub, ...args] = tokens.slice(at + 1);
        const flags = [];
        for (let i = 0; i < args.length; i++) {
            if (!args[i].startsWith('--')) {
                continue;
            }
            const eq = args[i].indexOf('=');
            if (eq !== -1) {
                flags.push({name: args[i].slice(2, eq), value: args[i].slice(eq + 1)});
            } else if (i + 1 < args.length && !args[i + 1].startsWith('--')) {
                flags.push({name: args[i].slice(2), value: args[++i]});
            } else {
                flags.push({name: args[i].slice(2), value: null});
            }
        }
        commands.push({sub, flags, line: raw});
    }
    return commands;
}

export function evaluateContract({commands, usage, readme, pilotSource, handoffSource, coordinatorKinds}) {
    const errors = [];
    const used = Object.fromEntries(SUBCOMMANDS.map((name) => [name, []]));
    const inUsage = flagsBySubcommand(usage);
    const docs = parseReadme(readme);

    for (const {sub, flags} of commands) {
        if (!SUBCOMMANDS.includes(sub)) {
            errors.push(`a script calls pilot.mjs ${sub}, which the contract does not list`);
            continue;
        }
        for (const {name, value} of flags) {
            used[sub].push(name);
            if (!inUsage[sub].has(name)) {
                errors.push(`pilot.mjs ${sub}: --${name} is not in the usage that pilot.mjs prints (unknown flag)`);
            }
            if (!docs.documented[sub].has(name)) {
                errors.push(`pilot.mjs ${sub}: --${name} is not in the README's flag list`);
            }
            if (NOT_FOR_CI.includes(name)) {
                errors.push(`pilot.mjs ${sub}: --${name} is a test or terminal flag and must not be passed by CI`);
            }
            const pattern = VALUE_PATTERNS[name];
            if (pattern && !pattern[0].test(String(value))) {
                errors.push(`pilot.mjs ${sub}: --${name} must be ${pattern[1]}`);
            }
        }
    }

    const runs = commands.filter((c) => c.sub === 'run');
    for (const command of runs) {
        const names = command.flags.map((f) => f.name);
        for (const flag of docs.headlessRun) {
            if (!names.includes(flag) && flag !== 'dry-run') {
                errors.push(`pilot.mjs run: the documented headless flag --${flag} is missing`);
            }
        }
        const target = command.flags.find((f) => f.name === 'target')?.value;
        if (names.includes('verify-spec') && target !== 'release') {
            errors.push('pilot.mjs run: --verify-spec runs on --target release only');
        }
    }
    if (runs.length !== 1) {
        errors.push(`expected exactly one pilot.mjs run command, found ${runs.length}`);
    }
    for (const sub of ['doctor', 'export', 'summary']) {
        if (!commands.some((c) => c.sub === sub)) {
            errors.push(`no script calls pilot.mjs ${sub}`);
        }
    }

    const restricted =
        /target\s*!==\s*'release'/.test(pilotSource) && /--verify-spec runs on the pinned release/.test(pilotSource);
    if (restricted) {
        const unsupported = coordinatorKinds.filter((kind) => kind !== 'release');
        if (unsupported.length > 0) {
            errors.push(
                `the workflow accepts target kind ${unsupported.join(', ')} but pilot.mjs verifyInputs refuses it`,
            );
        }
    }

    const defaultTimeout = Number(/DEFAULT_TIMEOUT_SECONDS\s*=\s*(\d+)/.exec(handoffSource)?.[1]);
    if (defaultTimeout !== ORCHESTRATOR_DEFAULT_VERIFIER_SECONDS) {
        errors.push(
            `the orchestrator's default verifier timeout is ${defaultTimeout} s, coordinator_plan.mjs assumes ${ORCHESTRATOR_DEFAULT_VERIFIER_SECONDS} s`,
        );
    }
    for (const code of docs.codes) {
        if (mapCoordinatorExit(code).detail.includes('unexpected')) {
            errors.push(`the README documents exit code ${code}, which coordinator_plan.mjs does not map`);
        }
    }
    if (docs.codes.length === 0) {
        errors.push('the README exit code table was not found');
    }
    return {errors, used, restricted};
}

function dryRunCommands(root) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ci-contract-'));
    try {
        const target = readJson(path.join(root, ORCH, 'targets/release.json'));
        const base = Object.fromEntries(
            Object.entries(process.env).filter(([key]) => !/^(GITHUB_|INPUT_|EXPLORER_|MM_LICENSE|PILOT_)/.test(key)),
        );
        const env = {
            ...base,
            EXPLORER_CI_DIR: dir,
            INPUT_TARGET_KIND: 'release',
            INPUT_IMAGE: `${target.image.ref}@${target.image.digest}`,
            INPUT_COMMIT_SHA: target.ref,
            INPUT_TEST_SOURCE_REF: '',
            INPUT_SESSION: 'bookmarks',
            INPUT_CONTROL: 'release-bookmark-title-changed',
            INPUT_VERIFIER: 'process',
            INPUT_TIME_BUDGET_MINUTES: '120',
            GITHUB_RUN_ATTEMPT: '1',
        };
        for (const script of ['check_inputs.mjs', 'run_facts.mjs']) {
            const args = script === 'run_facts.mjs' ? ['init'] : [];
            const done = spawnSync(process.execPath, [path.join(HERE, script), ...args], {env, encoding: 'utf8'});
            if (done.status !== 0) {
                throw new Error(`${script} failed while preparing the dry run: ${done.stdout}${done.stderr}`.trim());
            }
        }
        let output = '';
        for (const script of ['run_coordinator.sh', 'export_run.sh']) {
            const done = spawnSync('bash', [path.join(HERE, script), '--dry-run'], {env, encoding: 'utf8'});
            if (done.status !== 0) {
                throw new Error(`${script} --dry-run exited ${done.status}: ${done.stdout}${done.stderr}`.trim());
            }
            output += done.stdout;
        }
        return output;
    } finally {
        fs.rmSync(dir, {recursive: true, force: true});
    }
}

export function checkEntryContract({root = REPO_ROOT} = {}) {
    const commands = parseCommands(dryRunCommands(root));
    const result = evaluateContract({
        commands,
        usage: pilotUsage(root),
        readme: fs.readFileSync(path.join(root, ORCH, 'README.md'), 'utf8'),
        pilotSource: fs.readFileSync(path.join(root, ORCH, 'pilot.mjs'), 'utf8'),
        handoffSource: fs.readFileSync(path.join(root, ORCH, 'lib/verify/handoff.mjs'), 'utf8'),
        coordinatorKinds: COORDINATOR_TARGET_KINDS,
    });
    return {...result, commands};
}

function main() {
    const {flags} = parseArgs(process.argv.slice(2));
    let result;
    try {
        result = checkEntryContract({root: typeof flags.root === 'string' ? path.resolve(flags.root) : REPO_ROOT});
    } catch (error) {
        process.stdout.write(`entry contract: FAIL (${String(error.message).split('\n')[0]})\n`);
        return EXIT.FAIL;
    }
    for (const sub of SUBCOMMANDS) {
        process.stdout.write(
            `pilot.mjs ${sub}: ${result.used[sub].map((name) => `--${name}`).join(' ') || '(not called)'}\n`,
        );
    }
    for (const error of result.errors) {
        process.stdout.write(`entry contract: ${error}\n`);
    }
    process.stdout.write(
        `entry contract: ${result.errors.length === 0 ? 'PASS' : `FAIL (${result.errors.length})`} (${result.commands.length} commands, verify-spec restricted to release: ${result.restricted ? 'yes' : 'no'})\n`,
    );
    return result.errors.length === 0 ? EXIT.OK : EXIT.FAIL;
}

if (isMain(import.meta.url)) {
    process.exit(main());
}
