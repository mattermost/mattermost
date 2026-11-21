// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable @stylistic/dot-location, no-process-env -- Prettier owns formatting and the repo config relaxes these rules for .ts/.js only */

// The object a stage function receives: schema-validated artifact IO, the agent boundary, budget accounting and
// command execution that honours the stage's remaining time.
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import {runAgent} from './agents.mjs';
import {BudgetExceeded} from './budgets.mjs';
import {canonicalJson, readJson, REPO_ROOT, stageDirName, STAGE_NAMES, toPosix, writeFileAtomic} from './common.mjs';
import {validate} from './schemas.mjs';

export function countCalls(file, stage) {
    if (!fs.existsSync(file)) {
        return 0;
    }
    let n = 0;
    for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
        if (!line.trim()) {
            continue;
        }
        try {
            if (JSON.parse(line).stage === stage) {
                n++;
            }
        } catch {
            // malformed lines are reported by metrics.mjs's counter, not here
        }
    }
    return n;
}

export function createContext({flags, out, index, budget, provider, state, feature}) {
    const name = STAGE_NAMES[index];
    const dirName = stageDirName(index);
    const startedAt = process.hrtime.bigint();
    const callsFile = path.join(out, 'agent-calls.jsonl');

    const ctx = {
        flags,
        out,
        index,
        name,
        stageDirName: dirName,
        dir: path.join(out, dirName),
        budget,
        provider,
        state,
        feature,
        callsFile,

        dirOf: (i) => path.join(out, stageDirName(i)),
        rel: (abs) => toPosix(path.relative(out, abs)),
        stageRel: (file) => `${dirName}/${file}`,

        elapsedSeconds: () => Number(process.hrtime.bigint() - startedAt) / 1e9,
        remainingSeconds: () => budget.time_seconds - state.active_seconds - ctx.elapsedSeconds(),

        writeJson(file, data, schemaRef) {
            if (schemaRef) {
                const verdict = validate(schemaRef, data);
                if (!verdict.ok) {
                    throw new Error(
                        `artifact ${dirName}/${file} violates ${schemaRef}: ${verdict.errors.slice(0, 3).join('; ')}`,
                    );
                }
            }
            writeFileAtomic(path.join(ctx.dir, file), canonicalJson(data));
        },

        writeText(file, text) {
            writeFileAtomic(path.join(ctx.dir, file), text);
        },

        readJson(stage, file, schemaRef) {
            const data = readJson(path.join(ctx.dirOf(stage), file));
            if (schemaRef) {
                const verdict = validate(schemaRef, data);
                if (!verdict.ok) {
                    throw new Error(
                        `artifact ${stageDirName(stage)}/${file} violates ${schemaRef}: ${verdict.errors.slice(0, 3).join('; ')}`,
                    );
                }
            }
            return data;
        },

        exists: (stage, file) => fs.existsSync(path.join(ctx.dirOf(stage), file)),

        logAgentCall(entry) {
            const line = {stage: name, ...entry};
            const verdict = validate('orch#agent-call', line);
            if (!verdict.ok) {
                throw new Error(`agent call record invalid: ${verdict.errors[0]}`);
            }
            fs.appendFileSync(callsFile, `${JSON.stringify(line)}\n`);
        },

        hasLoggedOk(taskId) {
            if (!fs.existsSync(callsFile)) {
                return false;
            }
            return fs
                .readFileSync(callsFile, 'utf8')
                .split('\n')
                .some((line) => line.includes(`"task_id":"${taskId}"`) && line.includes('"outcome":"ok"'));
        },

        assertAgentCallAllowed() {
            if (countCalls(callsFile, name) >= budget.agent_calls) {
                throw new BudgetExceeded('agent_calls_exceeded', `agent call cap of ${budget.agent_calls} reached`);
            }
        },

        agent: (spec) => runAgent(ctx, spec),

        /** Runs a command without a shell; the child is killed when the stage's remaining time is used up. */
        exec(argv, {cwd = REPO_ROOT, env = process.env, capture = false, quiet = false} = {}) {
            const remaining = ctx.remainingSeconds();
            if (remaining <= 0) {
                throw new BudgetExceeded('time_exceeded', 'stage time budget used up before the command started');
            }
            const result = spawnSync(argv[0], argv.slice(1), {
                cwd,
                env,
                encoding: 'utf8',
                timeout: Math.ceil(remaining * 1000),
                killSignal: 'SIGKILL',
                stdio: capture ? ['ignore', 'pipe', 'ignore'] : ['ignore', 'ignore', quiet ? 'ignore' : 'inherit'],
                maxBuffer: 64 * 1024 * 1024,
            });
            if (result.error?.code === 'ETIMEDOUT') {
                throw new BudgetExceeded(
                    'time_exceeded',
                    `command exceeded the stage time budget (${path.basename(argv[0])})`,
                );
            }
            return {status: result.status ?? 1, stdout: capture ? (result.stdout ?? '') : ''};
        },
    };
    return ctx;
}
