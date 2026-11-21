// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable @stylistic/wrap-regex -- Prettier owns formatting and the repo config relaxes these rules for .ts/.js only */

// Per-stage budgets: active time, agent-call cap and retry cap. Exceeding any of them is a reported failure.
import path from 'node:path';

import {ORCH_DIR, readJson, STAGE_NAMES} from './common.mjs';

const KEYS = {time: 'time_seconds', time_seconds: 'time_seconds', agent_calls: 'agent_calls', retries: 'retries'};

export class BudgetExceeded extends Error {
    constructor(outcome, message) {
        super(message);
        this.outcome = outcome;
    }
}

/** overrides: ["select.time=1", "verify.agent_calls=2"]; throws on a malformed entry. */
export function loadBudgets(overrides = []) {
    const config = readJson(path.join(ORCH_DIR, 'config', 'budgets.json'));
    const stages = structuredClone(config.stages);
    for (const entry of overrides) {
        const m = /^([a-z]+)\.([a-z_]+)=([0-9]+(?:\.[0-9]+)?)$/.exec(entry);
        if (!m || !STAGE_NAMES.includes(m[1]) || !KEYS[m[2]]) {
            throw new Error(`bad --budget "${entry}" (expected <stage>.<time|agent_calls|retries>=<number>)`);
        }
        stages[m[1]][KEYS[m[2]]] = Number(m[3]);
    }
    return stages;
}
