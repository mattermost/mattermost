// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable @stylistic/wrap-regex -- Prettier owns formatting and the repo config relaxes these rules for .ts/.js only */

// Validates every JSON artifact below a run output directory against its schema.
import fs from 'node:fs';
import path from 'node:path';

import {listFiles, readJson} from './common.mjs';
import {validate, validateWithSchema} from './schemas.mjs';

const STAGE_DIR = '(?:[0-9]-[a-z]+|verify|collect)';

const RULES = [
    [/^run\.json$/, 'orch#run-config'],
    [new RegExp(`^${STAGE_DIR}/stage-record\\.json$`), 'orch#stage-record'],
    [/^0-target\/(?:attempt-[1-9][0-9]*\/)?target\.json$/, 'target'],
    [/^0-target\/(?:attempt-[1-9][0-9]*\/)?target-check\.json$/, 'orch#target-check'],
    [/^0-target\/attempt-[1-9][0-9]*\/setup\.json$/, 'orch#stage0-setup'],
    [/^0-target\/attempt-[1-9][0-9]*\/attempt\.json$/, 'orch#stage0-attempt'],
    [/^0-target\/status\.json$/, 'orch#stage0-status'],
    [/^1-baseline\/baseline\.json$/, 'orch#baseline-record'],
    [/^2-control\/control\.json$/, 'orch#control-record'],
    [/^2-control\/failure-trace\.json$/, 'orch#failure-trace'],
    [/^verify\/dispatch\.json$/, 'orch#dispatch-record'],
    [/^collect\/collect\.json$/, 'orch#collect-record'],
    [/^summary\.json$/, 'orch#run-summary'],
    [/^1-index\/index-summary\.json$/, 'orch#index-summary'],
    [/^2-explore\/feature-plan\.json$/, 'orch#feature-plan'],
    [/^3-triage\/repro\.json$/, 'orch#repro'],
    [/^3-triage\/triage-summary\.json$/, 'orch#triage-summary'],
    [/^3-triage\/findings\/[^/]+\.json$/, 'finding'],
    [/^4-select\/selection\.json$/, 'orch#selection'],
    [/^4-select\/(?:charters|proposed)\/[^/]+\.json$/, 'charter'],
    [/^4-select\/verdicts\/[^/]+\.json$/, 'verdict'],
    [/^4-select\/coverage\/[^/]+\.json$/, 'orch#coverage-report'],
    [/^[56]-[a-z]+\/commands\.json$/, 'orch#commands'],
    [/^7-verify\/gates\/[^/]+\.json$/, 'orch#gate-results'],
    [/^7-verify\/verdicts\/[^/]+\.json$/, 'verdict'],
    [/^7-verify\/verify-summary\.json$/, 'orch#verify-summary'],
    [/^8-promote\/promote\.json$/, 'orch#promote'],
    [/^9-lessons\/lessons\/[^/]+\.json$/, 'lesson'],
    [/^9-lessons\/application-plan\.json$/, 'orch#lesson-plan'],
    [new RegExp(`^${STAGE_DIR}/agent-task(?:\\.[a-z-]+)?\\.json$`), 'orch#agent-task'],
];

function resultSchemaFor(out, relFile) {
    const m = /^(.*)\/agent-result((?:\.[a-z-]+)?)\.json$/.exec(relFile);
    if (!m) {
        return null;
    }
    const taskFile = path.join(out, m[1], `agent-task${m[2]}.json`);
    if (!fs.existsSync(taskFile)) {
        return {error: 'no matching agent task'};
    }
    const schema = readJson(taskFile).output.result_schema;
    if (schema.base === 'out') {
        return {schema: readJson(path.join(out, schema.file))};
    }
    return {ref: schema.definition ? `agent#${schema.definition}` : schema.id};
}

function checkAgentResult(resultSchema, data) {
    if (resultSchema.error) {
        return {ok: false, errors: [`/: ${resultSchema.error}`]};
    }
    return resultSchema.schema ? validateWithSchema(resultSchema.schema, data) : validate(resultSchema.ref, data);
}

/** Returns {checked, failures: [{file, errors}]}; skipStages are stage numbers whose directories are not checked. */
export function validateOutDir(out, {skipStages = []} = {}) {
    const failures = [];
    let checked = 0;
    const skip = new Set(skipStages.map((n) => `${n}-`));
    const files = listFiles(out, {
        skip: (rel) =>
            rel.startsWith('.state') ||
            rel.startsWith('.work') ||
            rel.startsWith('1-index/data') ||
            skip.has(rel.slice(0, 2)),
    });
    for (const file of files) {
        let outcome = null;
        if (file === 'agent-calls.jsonl') {
            checked++;
            for (const [i, line] of fs.readFileSync(path.join(out, file), 'utf8').split('\n').entries()) {
                if (!line.trim()) {
                    continue;
                }
                let check;
                try {
                    check = validate('orch#agent-call', JSON.parse(line));
                } catch {
                    check = {ok: false, errors: ['/: not JSON']};
                }
                if (!check.ok) {
                    failures.push({file: `${file}:${i + 1}`, errors: check.errors});
                }
            }
            continue;
        }
        const isResult = new RegExp(`^${STAGE_DIR}/agent-result(?:\\.[a-z-]+)?\\.json$`).test(file);
        if (
            !file.endsWith('.json') ||
            /\.(?:errors|rejected)\.json$/.test(file) ||
            /\/agent-schema(?:\.[a-z-]+)?\.json$/.test(file)
        ) {
            continue;
        }
        if (!isResult && !RULES.some(([re]) => re.test(file))) {
            continue;
        }
        let data;
        try {
            data = readJson(path.join(out, file));
        } catch {
            failures.push({file, errors: ['/: not valid JSON']});
            checked++;
            continue;
        }
        const resultSchema = resultSchemaFor(out, file);
        if (resultSchema) {
            outcome = checkAgentResult(resultSchema, data);
        } else {
            const rule = RULES.find(([re]) => re.test(file));
            outcome = validate(rule[1], data);
        }
        checked++;
        if (!outcome.ok) {
            failures.push({file, errors: outcome.errors});
        }
    }
    return {checked, failures};
}
