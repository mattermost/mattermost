// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable @stylistic/wrap-regex, @stylistic/multiline-ternary, @stylistic/operator-linebreak -- Prettier owns formatting and the repo relaxes these rules for .ts/.js only; awaits in loops run in order by design */

// Loads an agent task and checks an agent result before anything is written. Used by cmd-wrapper.mjs and the MCP
// server so that both refuse the same things. A result is advisory: this module can only reject, never soften.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import {AGENTS_DIR, isInside, loadRoleIndex, readJsonFile, realInside, REPO_ROOT, writeJsonFile} from './common.mjs';

import {validate, validateWithSchema} from '../../orchestrator/lib/schemas.mjs';
import {forbiddenKeyPattern, UNSAFE_TEXT_PATTERN} from '../../schemas/shared.mjs';

const KEY_WORDS = new RegExp(forbiddenKeyPattern());
const UNSAFE_TEXT = new RegExp(UNSAFE_TEXT_PATTERN);
const MAX_ERRORS = 20;

// Rules for text that looks like licence or credential material. Only rule names are ever reported, never the value.
const BASE64_RUN = /(?<![A-Za-z0-9+/=_.:-])[A-Za-z0-9+/]{60,}={0,2}(?![A-Za-z0-9+/=_.:-])/g;
export const LICENCE_LIKE_RULES = [
    {id: 'jwt-like', test: (t) => /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/.test(t)},
    {id: 'pem-block', test: (t) => new RegExp('-{5}BEGIN [A-Z ]{3,40}-{5}').test(t)},
    {id: 'licence-assignment', test: (t) => /\bMM_LICENSE\s*[=:]\s*[^\s`'"<>$]/.test(t)},
    {
        id: 'long-base64-run',
        test: (t) => (t.match(BASE64_RUN) ?? []).some((run) => !/^[0-9a-f]+$/i.test(run)),
    },
];

export function licenceLikeRules(text) {
    return LICENCE_LIKE_RULES.filter((rule) => rule.test(String(text))).map((rule) => rule.id);
}

export function sha256File(file) {
    return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

export function outDirOf(taskFile) {
    return path.resolve(path.dirname(taskFile), '..');
}

/** The only place a result may be written: the sibling of the task file with agent-task replaced by agent-result. */
export function pairedResultPath(taskFile) {
    const base = path.basename(taskFile);
    if (!/^agent-task(?:\.[a-z0-9-]+)?\.json$/.test(base)) {
        throw new Error('the task file must be named agent-task[.name].json');
    }
    return path.join(path.dirname(taskFile), base.replace(/^agent-task/, 'agent-result'));
}

function resolveRef(task, taskFile, ref) {
    return ref.base === 'repo'
        ? path.join(REPO_ROOT, ref.path ?? ref.file)
        : path.join(outDirOf(taskFile), ref.path ?? ref.file);
}

/** Reasons the task no longer matches the files it was written against (empty when it is current). */
export function staleReasons(task, taskFile) {
    const reasons = [];
    const hashed = [
        {what: 'prompt', file: path.join(REPO_ROOT, task.prompt.file), sha: task.prompt.sha256},
        {
            what: 'result schema',
            file: resolveRef(task, taskFile, task.output.result_schema),
            sha: task.output.result_schema.sha256,
        },
        ...task.inputs.map((i) => ({what: `input ${i.path}`, file: resolveRef(task, taskFile, i), sha: i.sha256})),
    ];
    for (const item of hashed) {
        if (!fs.existsSync(item.file)) {
            reasons.push(`${item.what}: file is missing`);
        } else if (sha256File(item.file) !== item.sha) {
            reasons.push(`${item.what}: sha256 differs from the task`);
        }
    }
    return reasons;
}

/** Reads and validates a task; throws with a message that holds no instance data. */
export function loadTask(taskFile) {
    let task;
    try {
        task = readJsonFile(taskFile);
    } catch {
        throw new Error('the task file is not valid JSON');
    }
    const verdict = validate('orch#agent-task', task);
    if (!verdict.ok) {
        throw new Error(`the task file is not an explorer-agent-task/v1: ${verdict.errors.slice(0, 3).join('; ')}`);
    }
    const expected = pairedResultPath(taskFile);
    const declared = path.join(outDirOf(taskFile), task.output.result_file);
    if (path.resolve(declared) !== path.resolve(expected)) {
        throw new Error('the task names a result file that is not the sibling of the task file');
    }
    if (!realInside(outDirOf(taskFile), expected)) {
        throw new Error('the result path leaves the run directory');
    }
    return task;
}

function walk(value, jsonPath, visit) {
    visit(value, jsonPath);
    if (Array.isArray(value)) {
        value.forEach((item, i) => walk(item, `${jsonPath}/${i}`, visit));
    } else if (value && typeof value === 'object') {
        for (const [key, item] of Object.entries(value)) {
            walk(item, `${jsonPath}/${key}`, visit);
        }
    }
}

/** Forbidden keys, unsafe text and licence-like text anywhere in the result. Reports paths and rules only. */
export function scanResult(data, roleEntry = null) {
    const index = loadRoleIndex();
    const blocked = new Set([...index.forbidden_result_keys, ...(roleEntry?.forbidden_result_keys ?? [])]);
    const errors = [];
    const add = (jsonPath, rule) => errors.push(`${jsonPath || '/'}: ${rule}`);
    walk(data, '', (value, jsonPath) => {
        const key = jsonPath.split('/').at(-1);
        if (key && Number.isNaN(Number(key))) {
            if (blocked.has(key.toLowerCase())) {
                add(jsonPath, 'forbidden field (approval, override or policy field)');
            } else if (KEY_WORDS.test(key)) {
                add(jsonPath, 'forbidden field name (route or step word)');
            }
        }
        if (typeof value === 'string') {
            if (UNSAFE_TEXT.test(value)) {
                add(jsonPath, 'unsafe text (origin, loopback host, session material or server id)');
            }
            for (const rule of licenceLikeRules(value)) {
                add(jsonPath, `licence-like text (${rule})`);
            }
        }
    });
    return errors;
}

function schemaErrors(task, taskFile, data) {
    const info = task.output.result_schema;
    if (info.definition) {
        return validate(`agent#${info.definition}`, data).errors;
    }
    const schema = readJsonFile(resolveRef(task, taskFile, info));
    return validateWithSchema(schema, data).errors;
}

/** Full check of a candidate result. Returns {ok, errors}; nothing is written. */
export function checkResult(task, taskFile, data, roleEntry = null) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
        return {ok: false, errors: ['/: the result must be a JSON object']};
    }
    const errors = [];
    errors.push(...scanResult(data, roleEntry));
    errors.push(...schemaErrors(task, taskFile, data));
    if (data.task_id !== task.task_id) {
        errors.push('/task_id: does not match the task (stale or foreign result)');
    }
    const limited = [...new Set(errors)].slice(0, MAX_ERRORS);
    return {ok: limited.length === 0, errors: limited};
}

/** Writes the result to its one allowed location. Call only after checkResult returned ok. */
export function writeResult(task, taskFile, data) {
    const target = pairedResultPath(taskFile);
    const out = outDirOf(taskFile);
    if (!isInside(out, target) || !realInside(out, target)) {
        throw new Error('refusing to write outside the run directory');
    }
    writeJsonFile(target, data);
    return target;
}

export function agentsRel(file) {
    return path.relative(AGENTS_DIR, file).split(path.sep).join('/');
}
