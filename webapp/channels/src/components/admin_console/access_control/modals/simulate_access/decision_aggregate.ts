// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PolicySimulationActionDecision} from '@mattermost/types/access_control';
import {POLICY_SIMULATION_BLAME_SOURCES} from '@mattermost/types/access_control';

/**
 * AggregateDecisionState rolls up the per-action decisions for a single
 * picker row into a single bucket the stacked chip renders against:
 *
 *   - 'pending'       — at least one action has no decision yet (debounce
 *                       in flight or row freshly added).
 *   - 'not-applicable' — every decision carries `no_applicable_policy` or
 *                       `no_applicable_rule` blame (the draft policy /
 *                       editing rule doesn't govern this user).
 *   - 'allowed'       — every action allows AND none are not-applicable.
 *   - 'denied'        — every action denies.
 *   - 'mixed'         — at least one allow + at least one deny in the same
 *                       row, so a single chip would be misleading; the
 *                       picker prompts the author to drill into the
 *                       per-permission breakdown modal.
 */
/**
 * Stable string keys for the rolled-up aggregate state. Re-export the
 * literals as a frozen object so consumers (picker_row, stacked chip,
 * tests) don't have to repeat the bare string in conditionals.
 */
export const AGGREGATE_DECISION_STATE = Object.freeze({
    PENDING: 'pending',
    NOT_APPLICABLE: 'not-applicable',
    ALLOWED: 'allowed',
    DENIED: 'denied',
    MIXED: 'mixed',
} as const);

export type AggregateDecisionState =
    (typeof AGGREGATE_DECISION_STATE)[keyof typeof AGGREGATE_DECISION_STATE];

/**
 * Aggregates a row's per-action decisions into a single chip-friendly
 * state. `decisions` is the map keyed by action name from the simulator
 * response; `pending` is set by the picker while a debounced simulate
 * dispatch is in flight.
 *
 * Counting rules:
 *  - actions missing from `decisions` count as pending (we haven't gotten
 *    a verdict yet).
 *  - decisions tagged with `no_applicable_policy` or `no_applicable_rule`
 *    blame are vacuous allows; they only roll up to 'not-applicable' when
 *    EVERY action is inapplicable. Mixed rows (one inapplicable + one real
 *    allow/deny) fold the inapplicable side into the real side so the
 *    chip reflects the actionable decisions.
 */
export function aggregateDecisions(
    actions: string[],
    decisions: Record<string, PolicySimulationActionDecision> | undefined,
    pending: boolean,
): AggregateDecisionState {
    if (pending || actions.length === 0) {
        return AGGREGATE_DECISION_STATE.PENDING;
    }
    if (!decisions) {
        return AGGREGATE_DECISION_STATE.PENDING;
    }

    let allows = 0;
    let denies = 0;
    let inapplicable = 0;
    let missing = 0;

    for (const action of actions) {
        const dec = decisions[action];
        if (!dec) {
            missing++;
            continue;
        }
        if (!dec.decision) {
            denies++;
            continue;
        }
        if (dec.blame?.some((b) =>
            (
                b.source === POLICY_SIMULATION_BLAME_SOURCES.NO_APPLICABLE_POLICY ||
                b.source === POLICY_SIMULATION_BLAME_SOURCES.NO_APPLICABLE_RULE
            ) &&
            b.outcome !== 'allow',
        )) {
            inapplicable++;
            continue;
        }
        allows++;
    }

    if (missing > 0) {
        return AGGREGATE_DECISION_STATE.PENDING;
    }
    if (inapplicable === actions.length) {
        return AGGREGATE_DECISION_STATE.NOT_APPLICABLE;
    }
    if (allows > 0 && denies > 0) {
        return AGGREGATE_DECISION_STATE.MIXED;
    }
    if (denies > 0) {
        return AGGREGATE_DECISION_STATE.DENIED;
    }
    return AGGREGATE_DECISION_STATE.ALLOWED;
}
