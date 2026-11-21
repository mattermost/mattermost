// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable @stylistic/dot-location, @stylistic/indent, @stylistic/multiline-ternary, @stylistic/operator-linebreak, no-await-in-loop -- Prettier owns formatting and the repo config relaxes these rules for .ts/.js only; the awaits run in order by design */

// The stage runner: resumability (a stage is skipped when its inputs hash and outputs still match its record),
// budgets, stage records in the bakeoff/metrics.mjs shape, and exit-code mapping.
import fs from 'node:fs';
import path from 'node:path';

import {parseAgents} from './agents.mjs';
import {BudgetExceeded, loadBudgets} from './budgets.mjs';
import {
    EXIT,
    hashFiles,
    listFiles,
    ORCH_DIR,
    readJson,
    sha256File,
    sha256Json,
    stageDirName,
    StageSignal,
    STAGE_NAMES,
    writeCanonical,
} from './common.mjs';
import {countCalls, createContext} from './context.mjs';
import {loadFeature} from './feature.mjs';
import {validate} from './schemas.mjs';
import {STAGES} from './stages/index.mjs';

import {countAgentCalls, stageRecord} from '../../bakeoff/metrics.mjs';
import {saveResult} from '../../bakeoff/result_set.mjs';
import {createValidators} from '../../schemas/validator.mjs';

const RECORD = 'stage-record.json';

function codeHash() {
    const files = [];
    for (const dir of ['lib', 'gates', 'schemas', 'prompts', 'config']) {
        for (const f of listFiles(path.join(ORCH_DIR, dir))) {
            files.push(`${dir}/${f}`);
        }
    }
    files.push('pilot.mjs');
    return sha256Json(files.sort().map((f) => [f, sha256File(path.join(ORCH_DIR, f))]));
}

function readState(out, index) {
    const file = path.join(out, '.state', `${stageDirName(index)}.json`);
    const base = {active_seconds: 0, retries_used: 0, invalid_results: 0};
    return fs.existsSync(file) ? {...base, ...readJson(file)} : base;
}

function writeState(out, index, state) {
    const file = path.join(out, '.state', `${stageDirName(index)}.json`);
    fs.mkdirSync(path.dirname(file), {recursive: true});
    fs.writeFileSync(file, JSON.stringify(state));
}

function clearStageDir(dir) {
    if (!fs.existsSync(dir)) {
        return;
    }
    for (const entry of fs.readdirSync(dir)) {
        if (!entry.startsWith('agent-result')) {
            fs.rmSync(path.join(dir, entry), {recursive: true, force: true});
        }
    }
}

export function exitFor(result) {
    return {pass: EXIT.OK, skipped: EXIT.OK, fail: EXIT.FAIL, blocked: EXIT.BLOCKED}[result] ?? EXIT.FAIL;
}

function upToDate(ctx, inputsHash) {
    const file = path.join(ctx.dir, RECORD);
    if (!fs.existsSync(file)) {
        return false;
    }
    let record;
    try {
        record = readJson(file);
    } catch {
        return false;
    }
    if (
        record.inputs_hash !== inputsHash ||
        !['pass', 'skipped'].includes(record.result) ||
        record.budget_outcome !== 'within'
    ) {
        return false;
    }
    const current = hashFiles(ctx.dir, listFiles(ctx.dir, {skip: (rel) => rel === RECORD}));
    return sha256Json(current) === sha256Json(record.outputs);
}

function describe(e) {
    const text = String(e?.message ?? e)
        .replace(/\s+/g, ' ')
        .slice(0, 380);
    return text;
}

function breach(ctx, state) {
    if (state.active_seconds > ctx.budget.time_seconds) {
        return [
            'time_exceeded',
            `active time ${state.active_seconds.toFixed(1)}s exceeded the ${ctx.budget.time_seconds}s budget`,
        ];
    }
    if (countCalls(ctx.callsFile, ctx.name) > ctx.budget.agent_calls) {
        return ['agent_calls_exceeded', `more than ${ctx.budget.agent_calls} agent calls`];
    }
    if (state.retries_used > ctx.budget.retries) {
        return ['retries_exceeded', `more than ${ctx.budget.retries} retries`];
    }
    return null;
}

function appendToResultSet(file, metrics) {
    const result = readJson(file);
    result.cost ??= {stages: []};
    result.cost.stages.push(metrics);
    saveResult(createValidators(), file, result);
}

async function executeStage(stage, ctx, cfg, inputsHash) {
    clearStageDir(ctx.dir);
    fs.mkdirSync(ctx.dir, {recursive: true});
    const before = countAgentCalls(ctx.callsFile);
    const startedAt = new Date().toISOString();
    const t0 = process.hrtime.bigint();
    let outcome;
    let exitCode;
    try {
        outcome = await stage.run(ctx);
        exitCode = exitFor(outcome.result);
    } catch (e) {
        if (e instanceof StageSignal) {
            outcome = {result: e.status, reason: e.message, signal: e};
            exitCode = e.exitCode;
        } else if (e instanceof BudgetExceeded) {
            outcome = {result: 'fail', reason: `budget exceeded: ${e.message}`, outcomeOverride: e.outcome};
            exitCode = EXIT.FAIL;
        } else {
            outcome = {result: 'fail', reason: describe(e)};
            exitCode = EXIT.FAIL;
        }
    }
    const elapsed = Number(process.hrtime.bigint() - t0) / 1e9;
    const endedAt = new Date().toISOString();
    ctx.state.active_seconds += elapsed;

    let budgetOutcome = 'within';
    const exceeded =
        breach(ctx, ctx.state) ?? (outcome.outcomeOverride ? [outcome.outcomeOverride, outcome.reason] : null);
    if (exceeded) {
        budgetOutcome = exceeded[0];
        if (['pass', 'skipped'].includes(outcome.result)) {
            outcome = {result: 'fail', reason: `budget exceeded: ${exceeded[1]}`};
            exitCode = EXIT.FAIL;
        }
    }
    writeState(ctx.out, ctx.index, ctx.state);

    const outputs = hashFiles(ctx.dir, listFiles(ctx.dir, {skip: (rel) => rel === RECORD}));
    const metrics = stageRecord({
        stage: stageDirName(ctx.index),
        category: 'pipeline',
        command: 'pilot',
        argCount: cfg.argCount,
        status: exitCode,
        elapsedSeconds: ctx.state.active_seconds,
        before,
        after: countAgentCalls(ctx.callsFile),
        startedAt,
        endedAt,
    });
    metrics.agent_calls = countCalls(ctx.callsFile, ctx.name);
    const record = {
        schema: 'explorer-stage-record/v1',
        metrics,
        result: outcome.result,
        budget: {...ctx.budget},
        budget_outcome: budgetOutcome,
        retries_used: ctx.state.retries_used,
        inputs_hash: inputsHash,
        outputs,
    };
    if (outcome.reason) {
        record.reason = outcome.reason.slice(0, 400);
    }
    const verdict = validate('orch#stage-record', record);
    if (!verdict.ok) {
        throw new Error(`internal: stage record invalid: ${verdict.errors[0]}`);
    }
    writeCanonical(path.join(ctx.dir, RECORD), record);
    if (cfg.resultFile && ['pass', 'skipped'].includes(record.result)) {
        appendToResultSet(cfg.resultFile, record.metrics);
    }
    return {record, exitCode, signal: outcome.signal};
}

function printStage(ctx, record) {
    const reason = record.reason ? `  ${record.reason}` : '';
    process.stdout.write(
        `${stageDirName(ctx.index).padEnd(12)} ${record.result.padEnd(14)} ${record.metrics.elapsed_seconds.toFixed(1).padStart(7)}s  agent calls ${record.metrics.agent_calls}  budget ${record.budget_outcome}${reason}\n`,
    );
}

/** Runs the selected stages in order and stops at the first one that is not pass or skipped. Returns the exit code. */
export async function runPipeline(cfg) {
    const out = path.resolve(cfg.out);
    fs.mkdirSync(out, {recursive: true});
    const runConfig = {
        schema: 'explorer-run-config/v1',
        target: cfg.target,
        feature: cfg.feature,
        mode: cfg.mode,
        live: cfg.live,
        agents: cfg.agents,
    };
    const checked = validate('orch#run-config', runConfig);
    if (!checked.ok) {
        process.stderr.write(`invalid run configuration: ${checked.errors.join('; ')}\n`);
        return EXIT.USAGE;
    }
    writeCanonical(path.join(out, 'run.json'), runConfig);

    let provider;
    let budgets;
    try {
        provider = parseAgents(cfg.agents);
        budgets = loadBudgets(cfg.budget ?? []);
    } catch (e) {
        process.stderr.write(`${e.message}\n`);
        return EXIT.USAGE;
    }
    if (provider.kind === 'stub' && cfg.live) {
        process.stderr.write('--agents=stub is for tests and cannot be combined with --live\n');
        return EXIT.USAGE;
    }

    const loaded = loadFeature(cfg.feature);
    if (!loaded.ok) {
        process.stderr.write(`feature ${cfg.feature}: ${loaded.errors.join('; ')}\n`);
        return loaded.exitCode;
    }

    const flags = {...cfg, out};
    const common = {mode: cfg.mode, live: cfg.live, target: cfg.target, feature: cfg.feature, code: codeHash()};
    const from = cfg.from ?? 0;
    const to = cfg.to ?? STAGE_NAMES.length - 1;
    process.stdout.write(
        `pilot run: target=${cfg.target} feature=${cfg.feature} mode=${cfg.mode} ${cfg.live ? 'LIVE' : 'dry'} agents=${provider.kind}\n`,
    );

    for (let index = from; index <= to; index++) {
        const stage = STAGES[index];
        const state = readState(out, index);
        const ctx = createContext({
            flags,
            out,
            index,
            budget: budgets[stage.name],
            provider,
            state,
            feature: loaded.feature,
        });
        ctx.featureInfo = loaded;
        const inModes = stage.modes.includes(cfg.mode);
        const parts = inModes ? await stage.inputs(ctx) : [];
        const inputsHash = sha256Json({...common, stage: stage.name, inModes, parts});
        const mustRun = cfg.force || (cfg.live && stage.runsEveryLiveInvocation);
        if (!mustRun && upToDate(ctx, inputsHash)) {
            process.stdout.write(`${stageDirName(index).padEnd(12)} up to date\n`);
            continue;
        }
        const effective = inModes
            ? stage
            : {
                  ...stage,
                  run: async () => ({
                      result: 'skipped',
                      reason: `skipped: mode ${cfg.mode} does not include this stage`,
                  }),
              };
        const {record, exitCode, signal} = await executeStage(effective, ctx, cfg, inputsHash);
        printStage(ctx, record);
        if (!['pass', 'skipped'].includes(record.result)) {
            if (signal?.extra?.taskAbs) {
                process.stdout.write(
                    `agent task:   ${signal.extra.taskAbs}\nresult file:  ${signal.extra.resultAbs}\nresume:       node explorer-proto/v2/orchestrator/pilot.mjs run --resume --out ${out}\n`,
                );
            }
            STAGES[0].teardown?.(flags);
            return exitCode;
        }
        state.active_seconds = 0;
        state.retries_used = 0;
        state.invalid_results = 0;
        writeState(out, index, state);
    }
    STAGES[0].teardown?.(flags);
    return EXIT.OK;
}
