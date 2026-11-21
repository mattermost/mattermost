#!/usr/bin/env node
// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Gate `lessons_guard`: a lesson (schema `lesson`) that would change a frozen gate, the promotion policy, the
// bakeoff rules or the schemas is refused unless it is approved by a named human. The orchestrator calls this
// before it ever acts on a lesson. The schema field is `approver` (the brief's `approved_by`); a lesson that
// carries `approved_by` instead is schema-invalid and therefore refused.
//
// Interface: gate.run({lessons: [path|object]}) -> {status: pass|fail, evidence}.
// CLI: lessons_guard.mjs <lesson.json>...   exit 0 allowed, 1 refused, 2 usage
import path from 'node:path';
import {fileURLToPath} from 'node:url';

import {createValidators, describeErrors} from '../schemas/validator.mjs';

import {
    UsageError,
    exitCodeFor,
    guarded,
    isHumanApprover,
    parseArgs,
    printJson,
    readJsonFile,
    runCli,
} from './common.mjs';

const PROTECTED_PREFIXES = ['explorer-proto/v2/gates', 'explorer-proto/v2/bakeoff', 'explorer-proto/v2/schemas'];
const PROTECTED_BASENAMES = ['promotion_policy.json'];
const PROTECTED_KINDS = new Set(['gate_threshold', 'lint_rule', 'leakage_rule']);
const PROTECTED_TEXT = /v2\/gates|promotion_policy|bakeoff\/(?:rules|preregistration|freeze)|v2\/bakeoff|v2\/schemas/i;

export function normalizeTarget(raw) {
    let text = String(raw ?? '');
    try {
        text = decodeURIComponent(text);
    } catch {
        // keep the raw text: an undecodable path is checked as written
    }
    return path.posix
        .normalize(text.replace(/\\/g, '/'))
        .replace(/^(\.\/)+/, '')
        .replace(/^\/+/, '')
        .toLowerCase();
}

export function isProtectedPath(raw) {
    const target = normalizeTarget(raw);
    if (target === '' || target.startsWith('../') || target === '..') {
        return true;
    }
    const inPrefix = PROTECTED_PREFIXES.some((p) => target === p || target.startsWith(`${p}/`));
    return inPrefix || PROTECTED_BASENAMES.includes(path.posix.basename(target));
}

let validators;
function lessonValidator() {
    validators ??= createValidators();
    return validators.get('lesson');
}

export function guardLesson(lesson, {validateSchema = true} = {}) {
    const evidence = [];
    const refuse = (rule, detail) => evidence.push({rule, ...(detail ? {detail} : {})});

    if (validateSchema) {
        const validate = lessonValidator();
        if (!validate(lesson)) {
            const hint =
                lesson && typeof lesson === 'object' && 'approved_by' in lesson
                    ? ' (the field is approver, not approved_by)'
                    : '';
            refuse('schema_invalid', `${describeErrors(validate.errors, 3).join('; ')}${hint}`);
        }
    }
    const check = lesson?.proposed_check ?? {};
    const touches = [];
    if (typeof check.target_file === 'string' && isProtectedPath(check.target_file)) {
        touches.push('protected_target');
    }
    if (PROTECTED_KINDS.has(check.kind)) {
        touches.push('protected_kind');
    }
    if ([check.description, lesson?.observation].some((t) => typeof t === 'string' && PROTECTED_TEXT.test(t))) {
        touches.push('protected_text');
    }
    if (touches.length > 0) {
        let approvalRule;
        if (lesson?.status !== 'approved') {
            approvalRule = 'approval_missing';
        } else if (!isHumanApprover(lesson.approver)) {
            approvalRule = 'approver_not_human';
        }
        if (approvalRule) {
            touches.forEach((rule) => refuse(rule));
            refuse(approvalRule, 'a lesson that changes a gate, policy, rule or schema needs a named human approver');
        }
    }
    if (lesson?.applied !== false) {
        refuse('applied_not_false', 'lessons are proposals only');
    }
    return {status: evidence.length === 0 ? 'pass' : 'fail', evidence, protected: touches.length > 0};
}

export const gate = {
    id: 'lessons_guard',
    run(ctx = {}) {
        return guarded(() => {
            const lessons = (ctx.lessons ?? []).map((l) => (typeof l === 'string' ? readJsonFile(l) : l));
            if (lessons.length === 0) {
                return {status: 'blocked', evidence: [{rule: 'input', detail: 'ctx.lessons is empty'}]};
            }
            const evidence = [];
            lessons.forEach((lesson, index) => {
                const result = guardLesson(lesson);
                evidence.push(...result.evidence.map((e) => ({...e, lesson: lesson?.id ?? `#${index + 1}`})));
            });
            return {status: evidence.length === 0 ? 'pass' : 'fail', evidence};
        });
    },
};

async function main() {
    const {positional} = parseArgs(process.argv.slice(2));
    if (positional.length === 0) {
        throw new UsageError('usage: lessons_guard.mjs <lesson.json>...');
    }
    const result = gate.run({lessons: positional});
    printJson(result);
    return result.status === 'blocked' ? 2 : exitCodeFor(result.status);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    runCli(main);
}
