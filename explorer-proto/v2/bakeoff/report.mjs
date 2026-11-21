#!/usr/bin/env node
// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Reads two bakeoff result sets and the pre-registered rules, prints a table and the verdict per decision clause.
//   node report.mjs --a <A.json> --b <B.json> [--rules <rules.json>] [--allow-unfrozen]
// Never writes any file. Exit 0 v2 better, 1 not shown better, 2 invalid input or tampered protocol.
import fs from 'node:fs';
import path from 'node:path';

import {createValidators, describeErrors} from '../schemas/validator.mjs';

import {
    FREEZE_FILE,
    isMain,
    parseArgs,
    PREREGISTRATION_FILE,
    readJson,
    relativeToRepo,
    RULES_FILE,
    sha256File,
} from './common.mjs';
import {decide, showFraction, summarize} from './metrics_lib.mjs';

class InputError extends Error {}

function loadValidated(validators, schemaName, file) {
    let data;
    try {
        data = readJson(file);
    } catch {
        throw new InputError(`${file} is not readable JSON`);
    }
    const validate = validators.get(schemaName);
    if (!validate(data)) {
        throw new InputError(
            `${file} does not match ${schemaName}:\n${describeErrors(validate.errors)
                .map((l) => `  ${l}`)
                .join('\n')}`,
        );
    }
    return data;
}

function checkFreeze(rulesFile, allowUnfrozen, b) {
    if (!fs.existsSync(FREEZE_FILE)) {
        if (!allowUnfrozen) {
            throw new InputError(
                'FREEZE.json is absent: the protocol is not frozen. Use --allow-unfrozen for a dry run.',
            );
        }
        return 'ABSENT (dry run, --allow-unfrozen)';
    }
    const freeze = readJson(FREEZE_FILE);
    for (const file of [rulesFile, PREREGISTRATION_FILE]) {
        const key = relativeToRepo(file);
        if (freeze.files?.[key] !== sha256File(file)) {
            throw new InputError(`${key} differs from FREEZE.json: the pre-registered rules changed after the freeze`);
        }
    }
    if (freeze.version_b?.frozen_sha !== b.version.commit) {
        throw new InputError('result set B was not produced at the frozen v2 commit recorded in FREEZE.json');
    }
    return `OK (aggregate ${freeze.aggregate_sha256.slice(0, 12)})`;
}

function row(cells, widths) {
    return `${cells.map((c, i) => String(c).padEnd(widths[i])).join('  ')}`.trimEnd();
}

function printTable(rows) {
    const widths = rows[0].map((_, i) => Math.max(...rows.map((r) => String(r[i]).length)));
    for (const r of rows) {
        process.stdout.write(`${row(r, widths)}\n`);
    }
}

const num = (v) => (v === null ? 'not recorded' : String(v));
const cost = (s, k) => (s.cost ? num(s.cost[k]) : 'not recorded');

function metricRows(a, b) {
    const rows = [['metric', 'A (v1 frozen)', 'B (v2)']];
    const add = (name, x, y) => rows.push([name, x, y]);
    add('features handled (of 4)', num(a.featuresHandled), num(b.featuresHandled));
    for (const id of Object.keys(a.features ?? b.features ?? {})) {
        const show = (s) => {
            if (!s.features) {
                return 'not recorded';
            }
            return `${s.features[id].handled ? 'yes' : 'no'}: ${s.features[id].why}`;
        };
        add(`  ${id}`, show(a), show(b));
    }
    add('stability: specs 20/20', showFraction(a.stability), showFraction(b.stability));
    add('stability: pooled passes', showFraction(a.stabilityPooled), showFraction(b.stabilityPooled));
    add(
        'control sensitivity',
        a.controls ? showFraction(a.controls.rate) : 'not recorded',
        b.controls ? showFraction(b.controls.rate) : 'not recorded',
    );
    add(
        'controls blocked',
        a.controls ? num(a.controls.blocked) : 'not recorded',
        b.controls ? num(b.controls.blocked) : 'not recorded',
    );
    add('route leakage violations', num(a.leakage), num(b.leakage));
    add('named controls (info)', num(a.namedControls), num(b.namedControls));
    for (const k of ['elapsed_seconds', 'agent_calls', 'fix_rounds', 'human_review_minutes']) {
        add(`cost: ${k}`, cost(a, k), cost(b, k));
    }
    return rows;
}

function separateRows(a, b) {
    const rows = [['reported separately (not in the decision)', 'A (v1 frozen)', 'B (v2)']];
    const add = (name, x, y) => rows.push([name, x, y]);
    add(
        'planted duplicates rejected',
        showFraction(a.duplicateRejection?.planted ?? null),
        showFraction(b.duplicateRejection?.planted ?? null),
    );
    add(
        'proposals non-equivalent (blind)',
        showFraction(a.duplicateRejection?.nonEquivalent ?? null),
        showFraction(b.duplicateRejection?.nonEquivalent ?? null),
    );
    for (const v of ['original', 'paraphrased', 'shuffled']) {
        add(
            `discovery success: ${v}`,
            showFraction(a.discovery?.byVariant[v] ?? null),
            showFraction(b.discovery?.byVariant[v] ?? null),
        );
    }
    add('bug oracles: known-bug recall', 'n/a (v2 only)', showFraction(b.recall));
    const fp = b.falsePositives;
    add(
        'bug oracles: false positives (clean build)',
        'n/a (v2 only)',
        fp
            ? `${fp.false_positive} of ${fp.confirmed} confirmed (${fp.per100.toFixed(2)} per 100 states), ${fp.unadjudicated} unadjudicated`
            : 'not recorded',
    );
    return rows;
}

function main(argv) {
    const {flags} = parseArgs(argv, {booleans: ['allow-unfrozen']});
    if (!flags.a || !flags.b) {
        process.stderr.write('usage: report.mjs --a <A.json> --b <B.json> [--rules <rules.json>] [--allow-unfrozen]\n');
        return 2;
    }
    try {
        const validators = createValidators();
        const rulesFile = path.resolve(flags.rules ?? RULES_FILE);
        const rules = loadValidated(validators, 'bakeoff-rules', rulesFile);
        const resultA = loadValidated(validators, 'bakeoff-result', flags.a);
        const resultB = loadValidated(validators, 'bakeoff-result', flags.b);
        if (resultA.version.label !== 'A' || resultB.version.label !== 'B') {
            throw new InputError('--a must be a result set labelled A and --b one labelled B');
        }
        if (resultA.version.commit !== rules.version_a.commit) {
            throw new InputError('result set A is not at the frozen v1 commit named in the rules');
        }
        const same = ['kind', 'sha', 'image_digest'].every((k) => resultA.target[k] === resultB.target[k]);
        if (!same) {
            throw new InputError('result sets A and B were not run on the same target (kind, sha, image digest)');
        }
        const freeze = checkFreeze(rulesFile, Boolean(flags['allow-unfrozen']), resultB);

        const a = summarize(resultA, rules);
        const b = summarize(resultB, rules);
        const decision = decide(a, b, rules);
        const decisive = resultA.target.kind === rules.primary_target_kind;

        process.stdout.write(
            `target: kind=${resultA.target.kind} sha=${resultA.target.sha} image=${resultA.target.image_digest}\n`,
        );
        process.stdout.write(`protocol freeze: ${freeze}\n`);
        process.stdout.write(
            `this target is ${decisive ? 'the primary target: the decision rule applies' : 'a secondary reference: indicative only, not decisive'}\n\n`,
        );
        printTable(metricRows(a, b));
        process.stdout.write('\n');
        for (const c of decision.clauses) {
            process.stdout.write(`${c.id} ${c.pass ? 'PASS' : 'FAIL'}  ${c.title}\n      ${c.detail}\n`);
        }
        process.stdout.write('\n');
        printTable(separateRows(a, b));
        const failed = decision.clauses.filter((c) => !c.pass).map((c) => c.id);
        process.stdout.write(
            `\nDECISION: ${decision.better ? 'v2 BETTER (all clauses PASS)' : `v2 NOT SHOWN BETTER (FAIL: ${failed.join(', ')})`}${decisive ? '' : ' [secondary target, indicative]'}\n`,
        );
        process.stdout.write('Results are indicative: small sample, see PREREGISTRATION.md threats to validity.\n');
        return decision.better ? 0 : 1;
    } catch (e) {
        if (e instanceof InputError) {
            process.stderr.write(`${e.message}\n`);
            return 2;
        }
        throw e;
    }
}

if (isMain(import.meta.url)) {
    process.exitCode = main(process.argv.slice(2));
}
