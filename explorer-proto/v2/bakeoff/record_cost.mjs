#!/usr/bin/env node
// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Manual cost entries: human review minutes, agent rounds, fix rounds, and cost-to-gain justifications.
//   node record_cost.mjs <result.json> --reviewer <handle> [--human-review-minutes N] [--agent-rounds N]
//                        [--fix-rounds N] [--feature F1] [--note <text>] [--justify <component>=<gain_metric>]...
// Each call appends entries; nothing is overwritten. Enter 0 explicitly when a quantity is genuinely zero:
// an absent entry means "not recorded", which fails the cost clause.
import {createValidators} from '../schemas/validator.mjs';

import {assertSanitized, isMain, parseArgs, readJson} from './common.mjs';
import {saveResult} from './result_set.mjs';

const QUANTITIES = [
    ['human-review-minutes', 'human_review_minutes'],
    ['agent-rounds', 'agent_rounds'],
    ['fix-rounds', 'fix_rounds'],
];

function parseQuantity(name, text) {
    const value = Number(text);
    if (!Number.isFinite(value) || value < 0) {
        throw new Error(`--${name} must be a non-negative number`);
    }
    return value;
}

function main(argv) {
    const {flags, positional} = parseArgs(argv, {repeatable: ['justify']});
    const [file] = positional;
    try {
        if (!file || !flags.reviewer) {
            throw new Error(
                'usage: record_cost.mjs <result.json> --reviewer <handle> [--human-review-minutes N] [--agent-rounds N] [--fix-rounds N] [--justify c=g]',
            );
        }
        const result = readJson(file);
        result.cost ??= {stages: []};
        const entries = [];
        for (const [flag, kind] of QUANTITIES) {
            if (flags[flag] !== undefined) {
                const entry = {kind, value: parseQuantity(flag, flags[flag]), reviewer: flags.reviewer};
                if (flags.feature) {
                    entry.feature_id = flags.feature;
                }
                if (flags.note) {
                    assertSanitized(flags.note, 'note');
                    entry.note = flags.note;
                }
                entries.push(entry);
            }
        }
        const justifications = (flags.justify ?? []).map((pair) => {
            const [component, gain] = pair.split('=');
            return {component, gain_metric: gain};
        });
        if (entries.length === 0 && justifications.length === 0) {
            throw new Error('nothing to record');
        }
        result.cost.manual = [...(result.cost.manual ?? []), ...entries];
        if (justifications.length) {
            result.cost.justifications = [...(result.cost.justifications ?? []), ...justifications];
        }
        saveResult(createValidators(), file, result);
        process.stdout.write(`recorded ${entries.length} cost entries and ${justifications.length} justifications\n`);
        return 0;
    } catch (e) {
        process.stderr.write(`${e.message}\n`);
        return 2;
    }
}

if (isMain(import.meta.url)) {
    process.exitCode = main(process.argv.slice(2));
}
