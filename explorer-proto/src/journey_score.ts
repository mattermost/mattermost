// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {stems} from './journey_charter.ts';
import type {RoleName} from './snapshot.ts';

// Generic, journey-independent weights. Documented in README-engine.md. A fully-satisfied checkpoint and
// a fired event dominate; novelty and goal lexical overlap guide discovery; a partial-clause term gives a
// tiny gradient; a small depth penalty keeps the search shallow. Fully-true checkpoints are weighted far
// above partial clauses so a structurally-true clause (e.g. an always-present tab) cannot create a moat.
export const WEIGHTS = {
    checkpoint: 100,
    event: 50,
    container: 60,
    novelty: 12,
    lexical: 6,
    partial: 1,
    depth: 1,
    fatigue: 25,
};

/** Count of distinct goal stems that appear in the candidate's accessible name (both stemmed). */
export function lexicalOverlap(name: string, goalTerms: Set<string>): number {
    const nameStems = stems(name, new Set());
    let n = 0;
    for (const term of goalTerms) {
        if (nameStems.has(term)) {
            n++;
        }
    }
    return n;
}

export type Progress = {
    fullCheckpoints: number;
    firedEvents: number;
    partialClauses: number;
};

export type ScoreComponents = {
    checkpoint: number;
    event: number;
    container: number;
    partial: number;
    novelty: number;
    lexical: number;
    depth: number;
    total: number;
};

/**
 * Child priority computed only from the goal terms, the parent's observed checkpoint progress, fired
 * events, whether an actionable container (menu/dialog) is open, novelty, and the child's depth. It
 * never references a control label or a step word. The container term implements modal_policy's intent
 * (while a menu or dialog is open, drill through its controls before wandering elsewhere).
 */
export function scoreChild(
    parent: {
        progress: Progress;
        novelty: number;
        depth: number;
        containerOpen: boolean;
    },
    candidate: RoleName,
    goalTerms: Set<string>,
): ScoreComponents {
    const lexical = lexicalOverlap(candidate.name, goalTerms);
    const depth = parent.depth + 1;
    const container = parent.containerOpen ? 1 : 0;
    const total =
        WEIGHTS.checkpoint * parent.progress.fullCheckpoints +
        WEIGHTS.event * parent.progress.firedEvents +
        WEIGHTS.container * container +
        WEIGHTS.partial * parent.progress.partialClauses +
        WEIGHTS.novelty * parent.novelty +
        WEIGHTS.lexical * lexical -
        WEIGHTS.depth * depth;
    return {
        checkpoint: parent.progress.fullCheckpoints,
        event: parent.progress.firedEvents,
        container,
        partial: parent.progress.partialClauses,
        novelty: parent.novelty,
        lexical,
        depth,
        total,
    };
}
