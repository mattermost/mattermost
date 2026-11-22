#!/usr/bin/env node
// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// The numbers and mappings run_coordinator.sh needs, derived from the orchestrator instead of copied from it.
//   coordinator_plan.mjs arithmetic [--budgets <budgets.json>]
//   coordinator_plan.mjs verifier-timeout --window <seconds> [--budgets <budgets.json>]
//   coordinator_plan.mjs reserve-seconds
//   coordinator_plan.mjs map-exit <code> --field <result|exit|detail|message>
//   coordinator_plan.mjs doctor-summary <file holding `pilot.mjs doctor` output>
// verifier-timeout prints whole seconds for `pilot.mjs run --verifier-timeout`, or exits 1 when the window is too small.
import fs from 'node:fs';
import path from 'node:path';

import {EXIT, isMain, parseArgs, readJson, REPO_ROOT} from './lib.mjs';

export const BUDGETS_FILE = path.join(REPO_ROOT, 'explorer-proto/v2/orchestrator/config/budgets.json');

// The stages of a --verify-spec run (STAGE_SETS.verify_spec in orchestrator/lib/common.mjs).
export const VERIFY_SPEC_STAGES = ['target', 'baseline', 'control', 'dispatch', 'collect'];

export const SETUP_ALLOWANCE_SECONDS = 20 * 60;
export const TEARDOWN_RESERVE_SECONDS = 10 * 60;
export const VERIFIER_MARGIN_SECONDS = 120;
export const MIN_VERIFIER_SECONDS = 600;
// DEFAULT_TIMEOUT_SECONDS in orchestrator/lib/verify/handoff.mjs; check_entry_contract.mjs verifies it.
export const ORCHESTRATOR_DEFAULT_VERIFIER_SECONDS = 1500;

const ceilTo = (value, step) => Math.ceil(value / step) * step;

export function loadStageBudgets(file = BUDGETS_FILE) {
    return readJson(file).stages;
}

export function budgetPlan(stages) {
    const seconds = Object.fromEntries(VERIFY_SPEC_STAGES.map((name) => [name, stages[name].time_seconds]));
    const coordinatorSeconds = VERIFY_SPEC_STAGES.reduce((sum, name) => sum + seconds[name], 0);
    const otherStagesSeconds = coordinatorSeconds - seconds.dispatch;
    const worstCaseSeconds = SETUP_ALLOWANCE_SECONDS + coordinatorSeconds + TEARDOWN_RESERVE_SECONDS;
    const minimumSeconds =
        SETUP_ALLOWANCE_SECONDS + TEARDOWN_RESERVE_SECONDS + otherStagesSeconds + ORCHESTRATOR_DEFAULT_VERIFIER_SECONDS;
    return {
        seconds,
        coordinatorSeconds,
        otherStagesSeconds,
        verifierCapSeconds: seconds.dispatch - VERIFIER_MARGIN_SECONDS,
        worstCaseMinutes: Math.ceil(worstCaseSeconds / 60),
        minimumMinutes: ceilTo(Math.ceil(minimumSeconds / 60), 10),
        recommendedMinutes: ceilTo(Math.ceil(worstCaseSeconds / 60), 10),
    };
}

/** The verifier gets the dispatch budget less a margin, or what is left of the window after the other stages. */
export function verifierTimeoutSeconds(plan, windowSeconds) {
    const seconds = Math.floor(Math.min(plan.verifierCapSeconds, windowSeconds - plan.otherStagesSeconds));
    if (!(seconds >= MIN_VERIFIER_SECONDS)) {
        return {
            ok: false,
            reason: `a ${Math.floor(windowSeconds)} s coordinator window leaves ${Math.max(seconds, 0)} s for the verifier after the other stages' budgets (${plan.otherStagesSeconds} s); at least ${MIN_VERIFIER_SECONDS} s are needed`,
        };
    }
    return {ok: true, seconds};
}

const EXIT_TEXT = {
    0: ['PASS', 0, 'the coordinator run passed'],
    1: ['FAIL', 1, 'a coordinator stage failed'],
    2: [
        'FAIL',
        2,
        'usage error: the workflow passed flags the coordinator rejected; this is a workflow bug, not a test result',
    ],
    3: ['BLOCKED', 3, 'a precondition is missing or a gate could not run; this is not a pass'],
    30: [
        'PENDING',
        30,
        'the run is incomplete (verification missing, rejected, unbound or timed out); this is not a pass',
    ],
};

/** Maps a `pilot.mjs run` exit code to the ledger result, the step exit code and the texts. */
export function mapCoordinatorExit(code) {
    let known = EXIT_TEXT[code];
    if (!known && (code === 124 || code === 137)) {
        known = ['FAIL', 1, 'the time budget ran out and the coordinator was stopped'];
    }
    if (!known && [20, 21, 22].includes(code)) {
        known = [
            'FAIL',
            code,
            `agent task code ${code}: --verifier=process starts no agent, so this is an orchestrator or workflow bug`,
        ];
    }
    const [result, exit, text] = known ?? ['FAIL', code, 'unexpected coordinator exit code'];
    return {
        result,
        exit,
        detail: `exit ${code}: ${text}`,
        message: `${result}: ${text} (exit ${code})`,
    };
}

export function summarizeDoctor(text) {
    const items = [...text.matchAll(/^(PASS|FAIL|SKIP) ([^:\n]+)/gm)].map((m) => ({status: m[1], name: m[2].trim()}));
    const count = (status) => items.filter((item) => item.status === status).length;
    const failing = items.filter((item) => item.status === 'FAIL').map((item) => item.name);
    return {
        pass: count('PASS'),
        fail: count('FAIL'),
        skip: count('SKIP'),
        failing,
        complete: /^doctor: (PASS|FAIL)/m.test(text) && items.length > 0,
    };
}

function arithmetic(plan) {
    const minutes = (value) => `${(value / 60).toFixed(1)} min`;
    const lines = [
        'orchestrator stage budgets of a --verify-spec run (config/budgets.json time_seconds):',
        ...VERIFY_SPEC_STAGES.map(
            (name) => `  ${name.padEnd(9)} ${String(plan.seconds[name]).padStart(5)} s  ${minutes(plan.seconds[name])}`,
        ),
        `  coordinator total ${plan.coordinatorSeconds} s = ${minutes(plan.coordinatorSeconds)} (the dispatch stage includes the verifier process)`,
        `gate and setup allowance ${minutes(SETUP_ALLOWANCE_SECONDS)}; export, teardown, scan, upload, summary reserve ${minutes(TEARDOWN_RESERVE_SECONDS)}`,
        `worst case ${plan.worstCaseMinutes} min; 45 minutes ${plan.worstCaseMinutes <= 45 ? 'is' : 'is NOT'} feasible`,
        `verifier timeout cap ${plan.verifierCapSeconds} s (dispatch budget less ${VERIFIER_MARGIN_SECONDS} s)`,
        `smallest input that leaves the orchestrator default verifier timeout (${ORCHESTRATOR_DEFAULT_VERIFIER_SECONDS} s): ${plan.minimumMinutes} min`,
        `recommended default: ${plan.recommendedMinutes} min`,
    ];
    return `${lines.join('\n')}\n`;
}

function main() {
    const {flags, positional} = parseArgs(process.argv.slice(2));
    const [command, argument] = positional;
    const budgetsFile = typeof flags.budgets === 'string' ? path.resolve(flags.budgets) : BUDGETS_FILE;
    if (command === 'arithmetic') {
        process.stdout.write(arithmetic(budgetPlan(loadStageBudgets(budgetsFile))));
        return EXIT.OK;
    }
    if (command === 'verifier-timeout') {
        const windowSeconds = Number(flags.window);
        if (!Number.isFinite(windowSeconds)) {
            process.stderr.write('verifier-timeout needs --window <seconds>\n');
            return EXIT.USAGE;
        }
        const result = verifierTimeoutSeconds(budgetPlan(loadStageBudgets(budgetsFile)), windowSeconds);
        if (!result.ok) {
            process.stderr.write(`${result.reason}\n`);
            return EXIT.FAIL;
        }
        process.stdout.write(`${result.seconds}\n`);
        return EXIT.OK;
    }
    if (command === 'reserve-seconds') {
        process.stdout.write(`${TEARDOWN_RESERVE_SECONDS}\n`);
        return EXIT.OK;
    }
    if (command === 'map-exit') {
        const code = Number(argument);
        const mapped = mapCoordinatorExit(code);
        if (!Number.isInteger(code) || !(flags.field in mapped)) {
            process.stderr.write('usage: coordinator_plan.mjs map-exit <code> --field <result|exit|detail|message>\n');
            return EXIT.USAGE;
        }
        process.stdout.write(`${mapped[flags.field]}\n`);
        return EXIT.OK;
    }
    if (command === 'doctor-summary') {
        const summary = summarizeDoctor(fs.readFileSync(path.resolve(argument ?? ''), 'utf8'));
        const failing = summary.failing.length > 0 ? `; failing: ${summary.failing.join(', ')}` : '';
        process.stdout.write(
            `${summary.complete ? '' : 'doctor output incomplete; '}${summary.pass} PASS, ${summary.fail} FAIL, ${summary.skip} SKIP${failing}\n`,
        );
        return EXIT.OK;
    }
    process.stderr.write(
        'usage: coordinator_plan.mjs <arithmetic|verifier-timeout|reserve-seconds|map-exit|doctor-summary> ...\n',
    );
    return EXIT.USAGE;
}

if (isMain(import.meta.url)) {
    process.exit(main());
}
