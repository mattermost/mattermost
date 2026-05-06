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
 *   - 'not-applicable' — every decision carries `no_applicable_policy`
 *                       blame (the draft policy doesn't govern this user).
 *   - 'allowed'       — every action allows AND none are not-applicable.
 *   - 'denied'        — every action denies.
 *   - 'mixed'         — at least one allow + at least one deny in the same
 *                       row, so a single chip would be misleading; the
 *                       picker prompts the author to drill into the
 *                       per-permission breakdown modal.
 */
export type AggregateDecisionState =
    | 'pending'
    | 'not-applicable'
    | 'allowed'
    | 'denied'
    | 'mixed';

/**
 * Aggregates a row's per-action decisions into a single chip-friendly
 * state. `decisions` is the map keyed by action name from the simulator
 * response; `pending` is set by the picker while a debounced simulate
 * dispatch is in flight.
 *
 * Counting rules:
 *  - actions missing from `decisions` count as pending (we haven't gotten
 *    a verdict yet).
 *  - decisions tagged with `no_applicable_policy` blame are vacuous
 *    allows; they only roll up to 'not-applicable' when EVERY action is
 *    inapplicable. Mixed rows (one inapplicable + one real allow/deny)
 *    fold the inapplicable side into the real side so the chip reflects
 *    the actionable decisions.
 */
export function aggregateDecisions(
    actions: string[],
    decisions: Record<string, PolicySimulationActionDecision> | undefined,
    pending: boolean,
): AggregateDecisionState {
    if (pending || actions.length === 0) {
        return 'pending';
    }
    if (!decisions) {
        return 'pending';
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
        if (dec.blame?.some((b) => b.source === POLICY_SIMULATION_BLAME_SOURCES.NO_APPLICABLE_POLICY)) {
            inapplicable++;
            continue;
        }
        allows++;
    }

    if (missing > 0) {
        return 'pending';
    }
    if (inapplicable === actions.length) {
        return 'not-applicable';
    }
    if (allows > 0 && denies > 0) {
        return 'mixed';
    }
    if (denies > 0) {
        return 'denied';
    }
    return 'allowed';
}
