// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable @stylistic/dot-location, @stylistic/indent, @stylistic/multiline-ternary, @stylistic/operator-linebreak, no-await-in-loop, no-process-env -- Prettier owns formatting and the repo config relaxes these rules for .ts/.js only; the awaits run in order by design */

// The stage runner: resumability (a stage is skipped when its inputs hash and outputs still match its record),
// budgets, stage records in the bakeoff/metrics.mjs shape, and exit-code mapping.
import fs from 'node:fs';
import path from 'node:path';

import {parseAgents} from './agents.mjs';
import {IMAGE_ENV} from './image.mjs';
import {BudgetExceeded, loadBudgets} from './budgets.mjs';
import {
    EXIT,
    hashFiles,
    listFiles,
    ORCH_DIR,
    readJson,
    sha256File,
    sha256Json,
    StageSignal,
    STAGE_SETS,
    writeCanonical,
} from './common.mjs';
import {countCalls, createContext} from './context.mjs';
import {loadFeature} from './feature.mjs';
import {validate} from './schemas.mjs';
import {STAGES} from './stages/index.mjs';
import {VERIFY_STAGES} from './verify/index.mjs';
import {buildPlan} from './verify/plan.mjs';
import {assertSpecUnchanged, SpecHashMismatch} from './verify/spec.mjs';

import {countAgentCalls, stageRecord} from '../../bakeoff/metrics.mjs';
import {saveResult} from '../../bakeoff/result_set.mjs';
import {createValidators} from '../../schemas/validator.mjs';

const RECORD = 'stage-record.json';

function codeHash() {
    const files = [];
    for (const dir of ['lib', 'gates', 'schemas', 'prompts', 'config', 'controls']) {
        for (const f of listFiles(path.join(ORCH_DIR, dir))) {
            files.push(`${dir}/${f}`);
        }
    }
    files.push('pilot.mjs');
    return sha256Json(files.sort().map((f) => [f, sha256File(path.join(ORCH_DIR, f))]));
}

function readState(out, set, index) {
    const file = path.join(out, '.state', `${set.dirs[index]}.json`);
    const base = {active_seconds: 0, retries_used: 0, invalid_results: 0};
    return fs.existsSync(file) ? {...base, ...readJson(file)} : base;
}

function writeState(out, set, index, state) {
    const file = path.join(out, '.state', `${set.dirs[index]}.json`);
    fs.mkdirSync(path.dirname(file), {recursive: true});
    fs.writeFileSync(file, JSON.stringify(state));
}

function clearStageDir(dir) {
    if (!fs.existsSync(dir)) {
        return;
    }
    for (const entry of fs.readdirSync(dir)) {
        if (!entry.startsWith('agent-result') && !/^attempt-[1-9][0-9]*$/.test(entry)) {
            fs.rmSync(path.join(dir, entry), {recursive: true, force: true});
        }
    }
}

export function exitFor(result) {
    return (
        {
            pass: EXIT.OK,
            skipped: EXIT.OK,
            fail: EXIT.FAIL,
            blocked: EXIT.BLOCKED,
            incomplete: EXIT.INCOMPLETE,
        }[result] ?? EXIT.FAIL
    );
}

const outputsOf = (ctx, stage) =>
    hashFiles(ctx.dir, listFiles(ctx.dir, {skip: (rel) => rel === RECORD || Boolean(stage.ignoreOutput?.(rel))}));

function upToDate(ctx, stage, inputsHash) {
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
    return sha256Json(outputsOf(ctx, stage)) === sha256Json(record.outputs);
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
    writeState(ctx.out, ctx.stageSet, ctx.index, ctx.state);

    const outputs = outputsOf(ctx, stage);
    const metrics = stageRecord({
        stage: ctx.stageDirName,
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
    return {record, exitCode, signal: outcome.signal, halt: outcome.halt};
}

function printStage(ctx, record) {
    const reason = record.reason ? `  ${record.reason}` : '';
    process.stdout.write(
        `${ctx.stageDirName.padEnd(12)} ${record.result.padEnd(14)} ${record.metrics.elapsed_seconds.toFixed(1).padStart(7)}s  agent calls ${record.metrics.agent_calls}  budget ${record.budget_outcome}${reason}\n`,
    );
}

function resumeCommand(cfg, out) {
    const target = cfg.runId ? `--run-id ${cfg.runId}` : `--out ${out}`;
    return `node explorer-proto/v2/orchestrator/pilot.mjs run --resume ${target}`;
}

function runConfigOf(cfg) {
    const config = {
        schema: 'explorer-run-config/v1',
        target: cfg.target,
        feature: cfg.feature,
        mode: cfg.mode,
        live: cfg.live,
        agents: cfg.agents,
    };
    if (cfg.image) {
        config.image = cfg.image.reference;
    }
    if (cfg.verifySpec) {
        Object.assign(config, {
            verifier: cfg.verifier ?? 'manual',
            ...(cfg.verifierTimeout ? {verifier_timeout_seconds: cfg.verifierTimeout} : {}),
            run_id: cfg.runId,
            session: cfg.session,
            engine_charter: cfg.engineCharter,
            verify_spec: {path: cfg.verifySpec.path, sha256: cfg.verifySpec.sha256},
            control: {id: cfg.control.id, file: cfg.control.file, sha256: cfg.control.sha256},
            inputs_fingerprint: cfg.inputsFingerprint,
        });
    } else if (cfg.session) {
        config.session = cfg.session;
    }
    return config;
}

const STALE_TREES = ['1-baseline', '2-control', 'verify', 'collect'];

/** Keeps the evidence of stages that proved something about an earlier fixture before a new fixture replaces them. */
function archiveSuperseded(out) {
    const file = path.join(out, '0-target', 'status.json');
    if (!fs.existsSync(file)) {
        return;
    }
    const attempts = readJson(file).attempts.length;
    const dest = path.join(out, 'superseded', `after-attempt-${attempts - 1}`);
    if (attempts < 2 || fs.existsSync(dest)) {
        return;
    }
    for (const name of [...STALE_TREES, 'summary.json', 'summary.md']) {
        const src = path.join(out, name);
        if (fs.existsSync(src)) {
            fs.cpSync(src, path.join(dest, name), {recursive: true});
        }
    }
}

function recordInvocation(out, cfg) {
    const file = path.join(out, 'commands.json');
    const doc = fs.existsSync(file)
        ? readJson(file)
        : {schema: 'explorer-commands-record/v1', run_id: cfg.runId, invocations: []};
    const entry = {n: doc.invocations.length + 1, argv: cfg.argv ?? [], exit_code: null};
    doc.invocations.push(entry);
    writeCanonical(file, doc);
    return (exitCode) => {
        entry.exit_code = exitCode;
        writeCanonical(file, doc);
    };
}

/** Runs the selected stages in order and stops at the first one that is not pass or skipped. Returns the exit code. */
export async function runPipeline(cfg) {
    const out = path.resolve(cfg.out);
    fs.mkdirSync(out, {recursive: true});
    if (!cfg.verifySpec) {
        return runStages(cfg, out);
    }
    const finish = recordInvocation(out, cfg);
    const exitCode = await runStages(cfg, out);
    finish(exitCode);
    return exitCode;
}

async function runStages(cfg, out) {
    const runConfig = runConfigOf(cfg);
    const checked = validate('orch#run-config', runConfig);
    if (!checked.ok) {
        process.stderr.write(`invalid run configuration: ${checked.errors.join('; ')}\n`);
        return EXIT.USAGE;
    }
    writeCanonical(path.join(out, 'run.json'), runConfig);
    if (cfg.image) {
        process.env[IMAGE_ENV] = cfg.image.reference;
    }
    if (cfg.verifySpec && !cfg.live) {
        const plan = buildPlan(cfg);
        const planned = validate('orch#run-plan', plan);
        if (!planned.ok) {
            throw new Error(`internal: run plan invalid: ${planned.errors[0]}`);
        }
        writeCanonical(path.join(out, 'plan.json'), plan);
    }

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

    const stages = cfg.verifySpec ? VERIFY_STAGES : STAGES;
    const stageSet = cfg.verifySpec ? STAGE_SETS.verify_spec : STAGE_SETS.pipeline;
    let loaded = {feature: null};
    if (!cfg.verifySpec) {
        loaded = loadFeature(cfg.feature);
        if (!loaded.ok) {
            process.stderr.write(`feature ${cfg.feature}: ${loaded.errors.join('; ')}\n`);
            return loaded.exitCode;
        }
    }

    const flags = {...cfg, out};
    const interruptAfter = (index) => {
        if (cfg.interruptAfterIndex === index) {
            process.stdout.write(`interrupt hook: SIGKILL after stage ${stageSet.dirs[index]}\n`);
            process.kill(process.pid, 'SIGKILL');
        }
    };
    const common = {mode: cfg.mode, live: cfg.live, target: cfg.target, feature: cfg.feature, code: codeHash()};
    const from = cfg.from ?? 0;
    const to = cfg.to ?? stages.length - 1;
    const what = cfg.verifySpec ? `verify-spec run=${cfg.runId}` : `feature=${cfg.feature} mode=${cfg.mode}`;
    process.stdout.write(
        `pilot run: target=${cfg.target} ${what} ${cfg.live ? 'LIVE' : 'dry'} agents=${provider.kind}\n`,
    );

    for (let index = from; index <= to; index++) {
        const stage = stages[index];
        if (cfg.verifySpec && index > 0) {
            try {
                assertSpecUnchanged(cfg);
            } catch (e) {
                if (!(e instanceof SpecHashMismatch)) {
                    throw e;
                }
                process.stdout.write(
                    `${stageSet.dirs[index].padEnd(12)} fail            spec_hash_mismatch: the spec differs from the hash recorded for this run (hard failure)\n`,
                );
                stages[0].teardown?.(flags);
                return EXIT.FAIL;
            }
        }
        const state = readState(out, stageSet, index);
        const ctx = createContext({
            flags,
            out,
            index,
            budget: budgets[stage.name],
            provider,
            state,
            feature: loaded.feature,
            stageSet,
        });
        ctx.featureInfo = loaded;
        const inModes = cfg.verifySpec || stage.modes.includes(cfg.mode);
        const parts = inModes ? await stage.inputs(ctx) : [];
        const inputsHash = sha256Json({...common, stage: stage.name, inModes, parts});
        let mustRun = Boolean(cfg.force);
        if (cfg.live && stage.liveReuse && !cfg.force) {
            const decision = await stage.liveReuse(ctx);
            if (decision.reuse) {
                if (decision.holdsStack) {
                    stage.adoptStack?.();
                }
                process.stdout.write(`${ctx.stageDirName.padEnd(12)} reused          ${decision.note}\n`);
                interruptAfter(index);
                continue;
            }
            ctx.rerunReason = decision.reason;
            mustRun = true;
        } else if (cfg.live && stage.liveReuse) {
            ctx.rerunReason = 'forced';
        }
        if (!mustRun && upToDate(ctx, stage, inputsHash)) {
            process.stdout.write(`${ctx.stageDirName.padEnd(12)} up to date\n`);
            interruptAfter(index);
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
        const {record, exitCode, signal, halt} = await executeStage(effective, ctx, cfg, inputsHash);
        printStage(ctx, record);
        if (!['pass', 'skipped'].includes(record.result)) {
            if (signal?.extra?.taskAbs) {
                process.stdout.write(
                    `agent task:   ${signal.extra.taskAbs}\nresult file:  ${signal.extra.resultAbs}\nresume:       ${resumeCommand(cfg, out)}\n`,
                );
            }
            stages[0].teardown?.(flags);
            return exitCode;
        }
        state.active_seconds = 0;
        state.retries_used = 0;
        state.invalid_results = 0;
        writeState(out, stageSet, index, state);
        if (cfg.verifySpec && index === 0 && cfg.live) {
            archiveSuperseded(out);
        }
        interruptAfter(index);
        if (halt) {
            process.stdout.write(
                `agent task:   ${halt.taskAbs}\nresult file:  ${halt.resultAbs}\nresume:       ${resumeCommand(cfg, out)}\n`,
            );
            stages[0].teardown?.(flags);
            return halt.exitCode;
        }
    }
    stages[0].teardown?.(flags);
    return EXIT.OK;
}
