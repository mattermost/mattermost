// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable @stylistic/wrap-regex -- Prettier owns formatting and the repo config relaxes these rules for .ts/.js only */

// Stage 9, lessons: an agent task only. Lessons are stored as proposals (status proposed, applied false). The
// application plan records which of them the orchestrator would refuse to apply without a recorded human approval.
import fs from 'node:fs';
import path from 'node:path';

import {dirDigest} from './util.mjs';

import {slug, stageDirName} from '../common.mjs';
import {assessLesson} from '../lessons_gate.mjs';

function checkLessons(ctx) {
    return (result) => {
        const errors = [];
        const ids = new Set();
        for (const lesson of result.lessons) {
            if (ids.has(lesson.id)) {
                errors.push(`/lessons: duplicate id ${lesson.id}`);
            }
            ids.add(lesson.id);
            for (const e of lesson.evidence) {
                const outFile = /^([0-9]-[a-z]+\/[^#:]+)/.exec(e.ref)?.[1];
                if (outFile && !fs.existsSync(path.join(ctx.out, outFile))) {
                    errors.push(`/lessons/${lesson.id}/evidence: ${e.ref} does not exist in this run`);
                }
            }
        }
        return errors;
    };
}

export default {
    index: 9,
    name: 'lessons',
    modes: ['explore', 'author', 'both'],

    inputs(ctx) {
        return [{select: dirDigest(ctx, 4)}, {verify: dirDigest(ctx, 7)}, {triage: dirDigest(ctx, 3)}];
    },

    async run(ctx) {
        const inputs = [];
        for (const [stage, file, purpose] of [
            [4, 'selection.json', 'select decisions'],
            [7, 'verify-summary.json', 'verification outcomes'],
            [3, 'triage-summary.json', 'triage outcomes'],
        ]) {
            if (ctx.exists(stage, file)) {
                inputs.push({path: `${stageDirName(stage)}/${file}`, base: 'out', purpose});
            }
        }
        const result = await ctx.agent({
            role: 'lesson-proposer',
            prompt: 'lessons.md',
            inputs,
            schemaRef: 'agent#lessons',
            check: checkLessons(ctx),
        });
        const plan = {schema: 'explorer-lesson-plan/v1', lessons: []};
        for (const lesson of result.lessons) {
            const file = `lessons/${slug(lesson.id)}.json`;
            ctx.writeJson(file, lesson, 'lesson');
            const verdict = assessLesson(lesson);
            plan.lessons.push({
                id: lesson.id,
                file: ctx.stageRel(file),
                ...(lesson.proposed_check.target_file ? {target_file: lesson.proposed_check.target_file} : {}),
                protected_target: verdict.protectedTarget,
                decision: verdict.decision,
                reason: verdict.reason,
            });
        }
        plan.lessons.sort((a, b) => (a.id < b.id ? -1 : 1));
        ctx.writeJson('application-plan.json', plan, 'orch#lesson-plan');
        const refused = plan.lessons.filter((l) => l.decision === 'refused_needs_human_approval').length;
        return {
            result: 'pass',
            reason: `${plan.lessons.length} lesson(s) proposed, ${refused} would be refused without human approval`,
        };
    },
};
