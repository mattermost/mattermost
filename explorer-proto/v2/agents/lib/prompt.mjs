// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable @stylistic/dot-location, @stylistic/multiline-ternary, @stylistic/operator-linebreak -- Prettier owns formatting and the repo relaxes these rules for .ts/.js only; awaits in loops run in order by design */

// Builds the text an agent tool receives for one task: the contract, the role file, the orchestrator's prompt, the
// inputs (inlined when small, otherwise by path) and the result schema. Also enforces each role's input deny-list.
import fs from 'node:fs';
import path from 'node:path';

import {AGENTS_DIR, loadRoleIndex, matchesAnyGlob, REPO_ROOT, ROLES_DIR, roleForTaskRole} from './common.mjs';
import {outDirOf} from './result_check.mjs';

export const DEFAULT_INLINE_LIMIT = 12000;
const TOTAL_INLINE_LIMIT = 60000;

export function roleEntryFor(task) {
    const entry = roleForTaskRole(loadRoleIndex(), task.role);
    if (!entry) {
        throw new Error(`no role file is registered for the task role "${task.role}"`);
    }
    return entry;
}

/** Input paths the role must not see. Returns the offending paths with the glob that matched. */
export function deniedInputs(task, roleEntry) {
    const index = loadRoleIndex();
    const globs = [...index.deny_input_globs_all, ...(roleEntry.deny_input_globs ?? [])];
    return task.inputs
        .map((input) => ({path: input.path, glob: matchesAnyGlob(input.path.replace(/^\.\//, ''), globs)}))
        .filter((hit) => hit.glob);
}

function inputFile(task, taskFile, input) {
    return input.base === 'repo' ? path.join(REPO_ROOT, input.path) : path.join(outDirOf(taskFile), input.path);
}

function readIfExists(file) {
    return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
}

function inputsSection(task, taskFile, inlineLimit) {
    let budget = TOTAL_INLINE_LIMIT;
    const lines = [];
    for (const input of task.inputs) {
        const file = inputFile(task, taskFile, input);
        const size = fs.existsSync(file) ? fs.statSync(file).size : -1;
        lines.push(`### ${input.path} (${input.base})`, `Purpose: ${input.purpose ?? 'not stated'}`, `Path: ${file}`);
        if (size >= 0 && size <= inlineLimit && size <= budget) {
            budget -= size;
            lines.push('Content:', '```', fs.readFileSync(file, 'utf8').trimEnd(), '```');
        } else {
            lines.push(`Content: not inlined (${size < 0 ? 'missing' : `${size} bytes`}); read it from the path.`);
        }
        lines.push('');
    }
    return lines.join('\n');
}

export function buildPrompt(task, taskFile, roleEntry, {inlineLimit = DEFAULT_INLINE_LIMIT} = {}) {
    const role = fs.readFileSync(path.join(ROLES_DIR, roleEntry.file), 'utf8');
    const contract = fs.readFileSync(path.join(AGENTS_DIR, 'CONTRACT.md'), 'utf8');
    const orchestratorPrompt = fs.readFileSync(path.join(REPO_ROOT, task.prompt.file), 'utf8');
    const info = task.output.result_schema;
    const schemaFile = inputFile(task, taskFile, {base: info.base, path: info.file});
    const schemaText = readIfExists(schemaFile) ?? '(schema file missing)';
    const definitionNote = info.definition
        ? `Your result must validate against the definition "${info.definition}" of this file; $ref entries to common.schema.json point at explorer-proto/v2/schemas/common.schema.json.`
        : 'Your result must validate against this schema.';

    return [
        `# Agent task ${task.task_id}`,
        '',
        `Stage: ${task.stage}. Task role: ${task.role}. Role file: ${roleEntry.file}.`,
        '',
        '## Contract',
        contract.trimEnd(),
        '',
        `## Role: ${roleEntry.id}`,
        role.trimEnd(),
        '',
        `## Orchestrator prompt (${task.prompt.file})`,
        orchestratorPrompt.trimEnd(),
        '',
        '## Inputs',
        inputsSection(task, taskFile, inlineLimit).trimEnd(),
        '',
        '## Output',
        `Echo "task_id": "${task.task_id}" in the result. ${definitionNote}`,
        `Allowed tools for this task: ${task.allowed_tools.join(', ')}.`,
        `Forbidden field-name words: ${task.forbidden.fields.join(', ')}.`,
        `Forbidden content: ${task.forbidden.content.join('; ')}.`,
        'Reply with the JSON result object and nothing else. The caller validates it and writes the result file.',
        '',
        '```json',
        schemaText.trimEnd(),
        '```',
        '',
    ].join('\n');
}
