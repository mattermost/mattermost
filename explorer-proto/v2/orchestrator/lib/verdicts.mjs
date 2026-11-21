// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Combining deterministic gate results into a verdict. Code decides; an agent can only agree or downgrade.
import {newId} from './common.mjs';

export function overallOf(gates) {
    if (gates.some((g) => g.result === 'fail')) {
        return 'fail';
    }
    if (gates.some((g) => g.result === 'blocked')) {
        return 'blocked';
    }
    return 'pass';
}

/** Outcome implied by the gate results alone, for a charter that reached the verify stage. */
export function outcomeOf(overall) {
    if (overall === 'pass') {
        return 'emitted_passing';
    }
    return overall === 'fail' ? 'failed' : 'blocked';
}

export function buildVerdict({subjectId, outcome, gates, bakeoffFeature, duplicateOf}) {
    const verdict = {
        schema: 'explorer-verdict/v2',
        verdict_id: newId('verdict', subjectId),
        subject: {kind: 'charter', id: subjectId},
        outcome,
        overall: overallOf(gates),
        gates,
    };
    if (bakeoffFeature) {
        verdict.feature_id = bakeoffFeature;
    }
    if (duplicateOf) {
        verdict.duplicate_of = duplicateOf;
    }
    return verdict;
}

/** The gate list from a verdict or a gate-result document, one entry per gate name (first failing wins). */
export function gateSummary(gates) {
    return gates.map((g) => `${g.gate}=${g.result}`).join(' ');
}
