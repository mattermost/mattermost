// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable @stylistic/multiline-ternary, @stylistic/operator-linebreak, @stylistic/wrap-regex -- Prettier owns formatting and the repo config relaxes these rules for .ts/.js only */

// Canned agent results for tests (--agents=stub[:scenario]). Never used in a live run; the pipeline refuses the
// combination. Results are schema-valid except where a scenario plants a defect on purpose.
import fs from 'node:fs';
import path from 'node:path';

import {ORCH_REPO_PATH, REPO_ROOT, sleep} from './common.mjs';
import {overallOf} from './verdicts.mjs';

const STOPWORDS = ['i', 'want', 'to', 'the', 'a', 'an', 'my', 'me', 'so', 'that', 'and', 'or', 'of', 'in', 'on', 'for'];

const LEAKAGE = {
    rules: [
        {id: 'L1', kind: 'ordered_phrase'},
        {id: 'L2', kind: 'numbered_steps'},
        {id: 'L3', kind: 'deny_labels', deny_list: 'explorer-proto/v2/bakeoff/deny_labels.json'},
        {id: 'L4', kind: 'unknown_key'},
        {id: 'L5', kind: 'forbidden_key'},
    ],
    exempt_paths: [],
};

const CANDIDATES = {
    'channels.favorites': {
        title: 'Favorites group is the first sidebar group after reload',
        actors: [{id: 'member', role: 'member'}],
        setup: ['create three public channels', 'mark one channel as a favorite for the member'],
        goal_terms: ['favorites group order', 'reload page keeps group'],
        checkpoints: [
            {
                description: 'favorites group lists exactly the marked channel after the page reloads',
                labels: ['favorites category', 'sidebar channel link'],
                expected_text: [],
            },
        ],
        ui_labels: ['favorites category', 'sidebar channel link'],
    },
    'channels.create-and-modals': {
        title: 'Create channel dialog submits from the keyboard',
        actors: [{id: 'member', role: 'member'}],
        setup: ['log in as a member'],
        goal_terms: ['create channel dialog', 'enter key submits'],
        checkpoints: [
            {
                description: 'the new channel is open after Enter submits the dialog',
                labels: ['create channel dialog', 'channel name field'],
                expected_text: [],
            },
        ],
        ui_labels: ['create channel dialog', 'channel name field'],
    },
};

function readInput(task, ctx, suffix) {
    const input = task.inputs.find((i) => i.path.endsWith(suffix));
    if (!input) {
        throw new Error(`stub agent: task has no input ending in ${suffix}`);
    }
    const abs = input.base === 'repo' ? path.join(REPO_ROOT, input.path) : path.join(ctx.out, input.path);
    return JSON.parse(fs.readFileSync(abs, 'utf8'));
}

function candidateFromEval(name) {
    const file = path.join(REPO_ROOT, 'explorer-proto/v2/index/eval/candidates', `${name}.json`);
    return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function charterFor(feature, suffix, goal) {
    return {
        schema: 'explorer-charter/v2',
        charter_id: `${feature.id}:${suffix}`,
        feature_id: feature.id,
        goal,
        consequence: feature.consequence,
        lane: 'Browser',
        start: feature.start,
        action_rules: feature.action_rules,
        goal_terms: {derive_from: 'goal', stopwords: STOPWORDS},
        budget: feature.budget,
        oracles: feature.oracles,
        dedupe: {key: `${feature.id}:${suffix}`},
        leakage: LEAKAGE,
    };
}

function proposeResult(task, ctx, scenario) {
    const feature = readInput(task, ctx, `features/${ctx.flags.feature}.json`);
    const base = {schema: 'explorer-select-result/v1', task_id: task.task_id};
    if (scenario === 'leaky') {
        const charter = charterFor(
            feature,
            'leaky',
            'I want to click the channel menu then click the first item, so that the result is visible.',
        );
        return {...base, proposals: [{charter, candidate: CANDIDATES[feature.id] ?? CANDIDATES['channels.favorites']}]};
    }
    if (scenario === 'duplicate-bookmark') {
        const charter = charterFor(
            feature,
            'bookmark-bar',
            'I want the bookmark bar to show only the links of the channel I am in, so that I never open a link from another channel.',
        );
        return {...base, proposals: [{charter, candidate: candidateFromEval('bookmark_bar_follows_switch')}]};
    }
    if (scenario === 'duplicate-likely') {
        const charter = charterFor(
            feature,
            'save-pin',
            'I want to save and pin messages, so that I can find them again.',
        );
        return {...base, proposals: [{charter, candidate: candidateFromEval('save_and_pin_messages')}]};
    }
    const charter = charterFor(feature, 'persists', feature.goal);
    return {...base, proposals: [{charter, candidate: CANDIDATES[feature.id] ?? CANDIDATES['channels.favorites']}]};
}

function citationFrom(at, fallback) {
    const m = /([A-Za-z0-9_.@+/-]+):([0-9]+)(?:\s|$)/.exec(at ?? '');
    return m ? {file: m[1], line: Number(m[2])} : fallback;
}

function reviewResult(task, ctx, scenario) {
    const reports = task.inputs.filter((i) => /coverage\/.+\.json$/.test(i.path));
    const reviews = reports.map((input) => {
        const report = JSON.parse(fs.readFileSync(path.join(ctx.out, input.path), 'utf8'));
        const top = report.results[0];
        const fallback = {file: top.test.file, line: top.test.line};
        const setupAt = top.axes.actor_setup.test.setup[0]?.split(' @ ').pop();
        const axis = (at, rationale) => ({citations: [citationFrom(at, fallback)], rationale});
        return {
            charter_id: input.purpose.replace(/^coverage report for /, ''),
            judgement: scenario === 'duplicate-bookmark' ? 'equivalent' : 'non_equivalent',
            compared_test: {suite: top.test.suite, file: top.test.file, line: top.test.line},
            axes: {
                actors_setup: axis(setupAt, 'Same actor count; setup differs in what is created.'),
                transitions: axis(
                    top.axes.transitions.test[0]?.at,
                    'Transition labels overlap only on sidebar navigation.',
                ),
                final_assertions: axis(
                    top.axes.final_assertions.test.at(-1)?.at,
                    'The final assertion checks a different outcome.',
                ),
            },
        };
    });
    return {schema: 'explorer-review-result/v1', task_id: task.task_id, reviews};
}

function triageResult(task, ctx, scenario) {
    const repro = readInput(task, ctx, 'repro.json');
    return {
        schema: 'explorer-triage-result/v1',
        task_id: task.task_id,
        classifications: repro.groups.map((g) => ({
            finding_id: g.finding_id,
            status: scenario === 'triage-overconfirm' || g.reproduced >= 2 ? 'confirmed' : 'candidate',
            severity_candidate: 'minor',
        })),
    };
}

function verifyResult(task, ctx, scenario) {
    const gateInputs = task.inputs.filter((i) => /gates\/.+\.json$/.test(i.path));
    const reviews = gateInputs.map((input) => {
        const doc = JSON.parse(fs.readFileSync(path.join(ctx.out, input.path), 'utf8'));
        const overall = overallOf(doc.gates);
        return {
            charter_id: doc.charter_id,
            equivalence: 'non_equivalent',
            leak_review: 'clean',
            proposed_overall: scenario === 'verdict-pass-with-failing-gate' ? 'pass' : overall,
            evidence: [{kind: 'verdict', ref: input.path}],
        };
    });
    return {schema: 'explorer-verify-result/v1', task_id: task.task_id, reviews};
}

function lessonsResult(task, ctx, scenario) {
    const targetFile =
        scenario === 'lesson-touches-gate'
            ? `${ORCH_REPO_PATH}/gates/spec_static.mjs`
            : `${ORCH_REPO_PATH}/prompts/select.md`;
    return {
        schema: 'explorer-lessons-result/v1',
        task_id: task.task_id,
        lessons: [
            {
                schema: 'explorer-lesson/v2',
                id: `lesson-${ctx.flags.feature}-1`,
                observation: 'Proposed charters for this feature needed a coverage review every time.',
                evidence: [{kind: 'report', ref: task.inputs[0].path}],
                proposed_check: {
                    kind: 'fixture_check',
                    description: 'Ask the proposer for a candidate with narrower checkpoints.',
                    target_file: targetFile,
                },
                status: 'proposed',
                applied: false,
            },
        ],
    };
}

const BY_ROLE = {
    'finding-triager': triageResult,
    'charter-proposer': proposeResult,
    'duplicate-reviewer': reviewResult,
    verifier: verifyResult,
    'lesson-proposer': lessonsResult,
};

export async function stubResult(task, ctx, scenario) {
    if (ctx.flags.live) {
        throw new Error('the stub agent is for tests and is refused in a live run');
    }
    if (scenario === 'sleep') {
        await sleep(3000);
    }
    if (scenario === 'invalid') {
        return {task_id: task.task_id, note: 'planted invalid result'};
    }
    const build = BY_ROLE[task.role];
    if (!build) {
        throw new Error(`stub agent has no result for role ${task.role}`);
    }
    return build(task, ctx, scenario);
}
