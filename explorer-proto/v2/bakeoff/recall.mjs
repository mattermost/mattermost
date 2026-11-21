#!/usr/bin/env node
// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Known-bug recall (v2 only): which reproducible known bugs did the oracles flag on the main SHA?
//   node recall.mjs --repro-set <repro-set.json> --findings <finding.json|dir>... [--target-sha <sha>] [--out <fragment.json>]
// A bug is flagged when a CONFIRMED finding has the bug's expected oracle class and, if the bug lists a state path,
// that exact path. Bugs with "reproduces": false are excluded from the denominator.
// The fragment goes into a result set with: result_set.mjs set <result.json> known_bug_recall <fragment.json>
import fs from 'node:fs';
import path from 'node:path';

import {createValidators, describeErrors} from '../schemas/validator.mjs';

import {canonicalJson, isMain, parseArgs, readJson, sha256File, writeJson} from './common.mjs';

function expand(input) {
    if (!fs.statSync(input).isDirectory()) {
        return [input];
    }
    return fs
        .readdirSync(input)
        .sort()
        .map((f) => path.join(input, f));
}

function findingFiles(inputs) {
    return inputs.flatMap(expand).filter((f) => f.endsWith('.json'));
}

export function scoreRecall(reproSet, findings) {
    const reproducing = reproSet.bugs.filter((b) => b.reproduces !== false).sort((a, b) => a.id.localeCompare(b.id));
    const confirmed = findings.filter((f) => f.status === 'confirmed').sort((a, b) => a.id.localeCompare(b.id));
    const perBug = reproducing.map((bug) => {
        const hit = confirmed.find(
            (f) => f.oracle === bug.expected_oracle_class && (!bug.state_path || f.state_path === bug.state_path),
        );
        return hit ? {bug_id: bug.id, flagged: true, finding_id: hit.id} : {bug_id: bug.id, flagged: false};
    });
    return {reproducing_total: reproducing.length, flagged: perBug.filter((p) => p.flagged).length, per_bug: perBug};
}

function main(argv) {
    const {flags, positional} = parseArgs(argv, {repeatable: ['findings']});
    try {
        if (!flags['repro-set'] || !flags.findings) {
            throw new Error(
                'usage: recall.mjs --repro-set <file> --findings <file|dir>... [--target-sha <sha>] [--out <file>]',
            );
        }
        if (positional.length) {
            throw new Error('unexpected positional arguments');
        }
        const validators = createValidators();
        const reproSet = readJson(flags['repro-set']);
        const validateRepro = validators.get('repro-set');
        if (!validateRepro(reproSet)) {
            throw new Error(
                `repro set is invalid:\n${describeErrors(validateRepro.errors)
                    .map((l) => `  ${l}`)
                    .join('\n')}`,
            );
        }
        if (flags['target-sha'] && flags['target-sha'] !== reproSet.target_sha) {
            throw new Error('repro set was made for a different target SHA');
        }
        const validateFinding = validators.get('finding');
        const findings = findingFiles(flags.findings).map((file) => {
            const finding = readJson(file);
            if (!validateFinding(finding)) {
                throw new Error(
                    `${file} is not a valid finding:\n${describeErrors(validateFinding.errors)
                        .map((l) => `  ${l}`)
                        .join('\n')}`,
                );
            }
            return finding;
        });
        const fragment = {repro_set_sha256: sha256File(flags['repro-set']), ...scoreRecall(reproSet, findings)};
        if (flags.out) {
            writeJson(flags.out, fragment);
        } else {
            process.stdout.write(canonicalJson(fragment));
        }
        process.stdout.write(`known-bug recall: ${fragment.flagged}/${fragment.reproducing_total}\n`);
        return 0;
    } catch (e) {
        process.stderr.write(`${e.message}\n`);
        return 2;
    }
}

if (isMain(import.meta.url)) {
    process.exitCode = main(process.argv.slice(2));
}
