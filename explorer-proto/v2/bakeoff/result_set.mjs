#!/usr/bin/env node
// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Creates and fills a bakeoff result set. Every write is validated against bakeoff-result.schema.json first.
//   node result_set.mjs init --label A|B --target <target.json> --out <result.json> [--commit <sha>]
//   node result_set.mjs set <result.json> <section> <fragment.json>
// Sections: features duplicate_rejection stability control_sensitivity discovery route_leakage
//           known_bug_recall false_positives. The cost section is written only by metrics.mjs and record_cost.mjs.
import fs from 'node:fs';

import {createValidators, describeErrors} from '../schemas/validator.mjs';

import {FREEZE_FILE, isMain, parseArgs, readJson, RULES_FILE, writeJson} from './common.mjs';

export const SETTABLE_SECTIONS = [
    'features',
    'duplicate_rejection',
    'stability',
    'control_sensitivity',
    'discovery',
    'route_leakage',
    'known_bug_recall',
    'false_positives',
];

export function validateResult(validators, result) {
    const validate = validators.get('bakeoff-result');
    return validate(result) ? [] : describeErrors(validate.errors);
}

export function saveResult(validators, file, result) {
    const errors = validateResult(validators, result);
    if (errors.length) {
        throw new Error(`result set would be invalid:\n${errors.map((l) => `  ${l}`).join('\n')}`);
    }
    writeJson(file, result);
}

function init(flags, validators) {
    const {label, target: targetFile, out} = flags;
    if (!['A', 'B'].includes(label) || !targetFile || !out) {
        throw new Error('init needs --label A|B --target <target.json> --out <result.json>');
    }
    if (fs.existsSync(out)) {
        throw new Error(`${out} already exists; result files are never overwritten`);
    }
    const target = readJson(targetFile);
    const validateTarget = validators.get('target');
    if (!validateTarget(target)) {
        throw new Error(
            `target file is invalid:\n${describeErrors(validateTarget.errors)
                .map((l) => `  ${l}`)
                .join('\n')}`,
        );
    }
    if (target.licence_check !== 'PASS') {
        throw new Error('licence check is FAIL: this is a setup failure, not a bakeoff run');
    }
    let commit = flags.commit;
    if (label === 'A') {
        commit = readJson(RULES_FILE).version_a.commit;
    } else if (!commit && fs.existsSync(FREEZE_FILE)) {
        commit = readJson(FREEZE_FILE).version_b.frozen_sha;
    }
    if (!commit) {
        throw new Error('label B needs --commit <frozen v2 sha> (or a FREEZE.json)');
    }
    saveResult(validators, out, {
        schema: 'explorer-bakeoff-result/v2',
        version: {label, name: label === 'A' ? 'v1 frozen' : 'v2', commit},
        target: {kind: target.kind, sha: target.sha, image_digest: target.image.digest},
    });
}

function setSection(positional, validators) {
    const [file, section, fragmentFile] = positional;
    if (!file || !SETTABLE_SECTIONS.includes(section) || !fragmentFile) {
        throw new Error(`set needs <result.json> <section> <fragment.json>; sections: ${SETTABLE_SECTIONS.join(', ')}`);
    }
    const result = readJson(file);
    result[section] = readJson(fragmentFile);
    saveResult(validators, file, result);
}

function main(argv) {
    const [command, ...rest] = argv;
    const {flags, positional} = parseArgs(rest);
    try {
        const validators = createValidators();
        if (command === 'init') {
            init(flags, validators);
        } else if (command === 'set') {
            setSection(positional, validators);
        } else {
            throw new Error('usage: result_set.mjs init|set ...');
        }
        return 0;
    } catch (e) {
        process.stderr.write(`${e.message}\n`);
        return 2;
    }
}

if (isMain(import.meta.url)) {
    process.exitCode = main(process.argv.slice(2));
}
