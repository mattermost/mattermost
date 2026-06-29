// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {defineMessages, FormattedMessage, useIntl} from 'react-intl';

import {CheckCircleIcon, CloseCircleIcon, MinusCircleIcon, MinusCircleOutlineIcon} from '@mattermost/compass-icons/components';
import type {PolicySimulationActionDecision, PolicySimulationBlame} from '@mattermost/types/access_control';
import {POLICY_SIMULATION_BLAME_SOURCES} from '@mattermost/types/access_control';

import './decision_chip.scss';

// Compact leading icons that match the spec's pill design — a filled
// circle marker that telegraphs the verdict before the eye reads the
// label. Sized to 14px so the pill stays the same overall height as
// before; the icon's colour inherits via `currentColor` from the
// pill's modifier class so each state's tinted text colour applies
// uniformly to the glyph too.
const ICON_SIZE = 14;

const blameSourceMessages = defineMessages({
    [POLICY_SIMULATION_BLAME_SOURCES.THIS_RULE]: {
        id: 'admin.access_control.simulate_access.blame.this_rule',
        defaultMessage: 'this rule',
    },
    [POLICY_SIMULATION_BLAME_SOURCES.SIBLING_RULE]: {
        id: 'admin.access_control.simulate_access.blame.sibling_rule',
        defaultMessage: 'another rule',
    },
    [POLICY_SIMULATION_BLAME_SOURCES.CHANNEL_POLICY]: {
        id: 'admin.access_control.simulate_access.blame.channel_policy',
        defaultMessage: 'parent policy',
    },
    [POLICY_SIMULATION_BLAME_SOURCES.SYSTEM_PERMISSION]: {
        id: 'admin.access_control.simulate_access.blame.system_permission',
        defaultMessage: 'system policy',
    },
    [POLICY_SIMULATION_BLAME_SOURCES.PEER_POLICY]: {
        id: 'admin.access_control.simulate_access.blame.peer_policy',
        defaultMessage: 'another policy',
    },
    [POLICY_SIMULATION_BLAME_SOURCES.NO_APPLICABLE_POLICY]: {
        id: 'admin.access_control.simulate_access.blame.no_applicable_policy',
        defaultMessage: "policy doesn't apply to this user",
    },
    [POLICY_SIMULATION_BLAME_SOURCES.NO_APPLICABLE_RULE]: {
        id: 'admin.access_control.simulate_access.blame.no_applicable_rule',
        defaultMessage: "this rule doesn't apply to this user",
    },
    [POLICY_SIMULATION_BLAME_SOURCES.SIBLING_SAVED]: {
        id: 'admin.access_control.simulate_access.blame.sibling_saved',
        defaultMessage: 'another rule',
    },
});

// Order of preference when more than one blame entry is present on a
// decision. We surface same-scope blame first because the chip has
// space for one source label, and "Denied · IL5 Block" is more useful
// than "Denied · system policy" when both contributors denied.
const DENY_BLAME_PRIORITY: string[] = [
    POLICY_SIMULATION_BLAME_SOURCES.THIS_RULE,
    POLICY_SIMULATION_BLAME_SOURCES.SIBLING_RULE,
    POLICY_SIMULATION_BLAME_SOURCES.PEER_POLICY,
    POLICY_SIMULATION_BLAME_SOURCES.SYSTEM_PERMISSION,
    POLICY_SIMULATION_BLAME_SOURCES.CHANNEL_POLICY,
];

type Props = {
    decision: PolicySimulationActionDecision | undefined;
    pending?: boolean;
};

/**
 * Per-user, per-action decision chip.
 *
 * The chip renders the blame source inline (e.g. "Denied · this rule"
 * rather than a tooltip-only hint) so authors can scan the list and tell
 * at a glance whether a deny is coming from the rule they're editing,
 * another rule in the same policy, or a system / parent policy
 * outside the editing scope.
 *
 * States:
 *   - pending → grey "Evaluating…" while a simulate dispatch is in flight.
 *   - ALLOW with sibling_saved blame → green "Allowed · another rule"
 *     because the editing rule alone would have denied (OR-bucket saved
 *     them).
 *   - ALLOW with no_applicable_policy blame → neutral "Policy doesn't
 *     apply" so the row doesn't masquerade as a meaningful pass.
 *   - ALLOW (no blame) → green "Allowed".
 *   - DENY → red "Denied · {source}" where source maps to one of the
 *     blame-source labels above.
 */
export default function DecisionChip({decision, pending}: Props): JSX.Element {
    const {formatMessage} = useIntl();

    if (pending || !decision) {
        return (
            <span
                className='SimulateAccessModal__rowChip SimulateAccessModal__rowChip--pending'
                data-testid='simulate-access-row-chip-pending'
            >
                <FormattedMessage
                    id='admin.access_control.simulate_access.chip.pending'
                    defaultMessage='Evaluating…'
                />
            </span>
        );
    }

    if (decision.decision) {
        // "This rule doesn't apply to this user" — the post-process
        // injects no_applicable_rule whenever the editing rule is
        // silent on the subject in the "this rule only" view (either
        // a sibling rule's OR-bucket saved the user, or the deny
        // came entirely from outside the editing rule). Checked
        // before no_applicable_policy because the rule-scoped marker
        // is strictly narrower: the policy as a whole may still
        // apply, just not this rule.
        if (hasBlame(decision.blame, POLICY_SIMULATION_BLAME_SOURCES.NO_APPLICABLE_RULE)) {
            return (
                <span
                    className='SimulateAccessModal__rowChip SimulateAccessModal__rowChip--not-applicable'
                    data-testid='simulate-access-row-chip-not-applicable-rule'
                >
                    <MinusCircleOutlineIcon
                        size={ICON_SIZE}
                        className='SimulateAccessModal__rowChipIcon'
                    />
                    <FormattedMessage {...blameSourceMessages[POLICY_SIMULATION_BLAME_SOURCES.NO_APPLICABLE_RULE]}/>
                </span>
            );
        }

        // The simulator marks "policy doesn't apply to this user" rows
        // with a synthetic vacuous ALLOW + a single no_applicable_policy
        // blame entry. Render as a softer neutral chip so the author isn't
        // misled into thinking the rule decided to allow them.
        if (hasBlame(decision.blame, POLICY_SIMULATION_BLAME_SOURCES.NO_APPLICABLE_POLICY)) {
            return (
                <span
                    className='SimulateAccessModal__rowChip SimulateAccessModal__rowChip--not-applicable'
                    data-testid='simulate-access-row-chip-not-applicable'
                >
                    <MinusCircleOutlineIcon
                        size={ICON_SIZE}
                        className='SimulateAccessModal__rowChipIcon'
                    />
                    <FormattedMessage {...blameSourceMessages[POLICY_SIMULATION_BLAME_SOURCES.NO_APPLICABLE_POLICY]}/>
                </span>
            );
        }

        // ALLOW with sibling_saved blame: the editing rule alone would
        // have denied. Surface that inline so authors can spot
        // "OR-saved" allows. Only reached when no_applicable_rule
        // wasn't injected — i.e. we're in the "All policies" view
        // where the sibling IS relevant context for the verdict.
        if (hasBlame(decision.blame, POLICY_SIMULATION_BLAME_SOURCES.SIBLING_SAVED)) {
            return (
                <span
                    className='SimulateAccessModal__rowChip SimulateAccessModal__rowChip--allow-saved'
                    data-testid='simulate-access-row-chip-allow-saved'
                >
                    <CheckCircleIcon
                        size={ICON_SIZE}
                        className='SimulateAccessModal__rowChipIcon'
                    />
                    <FormattedMessage
                        id='admin.access_control.simulate_access.chip.allow_with_blame'
                        defaultMessage='Allowed · {source}'
                        values={{source: formatMessage(blameSourceMessages[POLICY_SIMULATION_BLAME_SOURCES.SIBLING_SAVED])}}
                    />
                </span>
            );
        }

        return (
            <span
                className='SimulateAccessModal__rowChip SimulateAccessModal__rowChip--allow'
                data-testid='simulate-access-row-chip-allow'
            >
                <CheckCircleIcon
                    size={ICON_SIZE}
                    className='SimulateAccessModal__rowChipIcon'
                />
                <FormattedMessage
                    id='admin.access_control.simulate_access.chip.allow'
                    defaultMessage='Allowed'
                />
            </span>
        );
    }

    // In "all policies" mode, the fail-secure path produces
    // Decision=false with a no_applicable_* blame when the action is
    // governed but the subject's role doesn't match. Render the same
    // neutral "doesn't apply" pill rather than a hard "Denied" chip so
    // the UX stays consistent regardless of evaluation scope.
    if (hasBlame(decision.blame, POLICY_SIMULATION_BLAME_SOURCES.NO_APPLICABLE_RULE) ||
        hasBlame(decision.blame, POLICY_SIMULATION_BLAME_SOURCES.NO_APPLICABLE_POLICY)) {
        const source = hasBlame(decision.blame, POLICY_SIMULATION_BLAME_SOURCES.NO_APPLICABLE_RULE) ?
            POLICY_SIMULATION_BLAME_SOURCES.NO_APPLICABLE_RULE :
            POLICY_SIMULATION_BLAME_SOURCES.NO_APPLICABLE_POLICY;
        return (
            <span
                className='SimulateAccessModal__rowChip SimulateAccessModal__rowChip--not-applicable'
                data-testid={source === POLICY_SIMULATION_BLAME_SOURCES.NO_APPLICABLE_RULE ?
                    'simulate-access-row-chip-not-applicable-rule' :
                    'simulate-access-row-chip-not-applicable'}
            >
                <MinusCircleOutlineIcon
                    size={ICON_SIZE}
                    className='SimulateAccessModal__rowChipIcon'
                />
                <FormattedMessage {...blameSourceMessages[source]}/>
            </span>
        );
    }

    const blame = pickPrimaryDenyBlame(decision.blame);
    const blameLabel = blame ? blameSourceLabel(blame, formatMessage) : '';

    // Only same-scope blame is allowed to expose the contributing
    // rule/policy name in the tooltip. Upper-scoped sources
    // (system_permission, channel_policy) deliberately leave the
    // tooltip blank — the public-server's privacy boundary already
    // strips their `expression` and `evaluation_tree`, and surfacing
    // the rule/policy name here would leak metadata the author
    // shouldn't see at this scope.
    const blameTooltip = blame && SAME_SCOPE_BLAME_SOURCES.has(blame.source) ?
        (blame.rule_name || blame.policy_name || '') :
        '';

    return (
        <span
            className='SimulateAccessModal__rowChip SimulateAccessModal__rowChip--deny'
            data-testid='simulate-access-row-chip-deny'
            title={blameTooltip}
        >
            <CloseCircleIcon
                size={ICON_SIZE}
                className='SimulateAccessModal__rowChipIcon'
            />
            {blameLabel ? (
                <FormattedMessage
                    id='admin.access_control.simulate_access.chip.deny_with_blame'
                    defaultMessage='Denied · {source}'
                    values={{source: blameLabel}}
                />
            ) : (
                <FormattedMessage
                    id='admin.access_control.simulate_access.chip.deny'
                    defaultMessage='Denied'
                />
            )}
        </span>
    );
}

// Returned alongside the export so a caller can reuse the same icon
// glyph mapping (e.g. the multi-action StackedDecisionChip). Keeps
// the icon-state mapping in one place — single source of truth for
// "what does an allow look like in the picker".
export const ChipIcon = {Allow: CheckCircleIcon, Deny: CloseCircleIcon, Mixed: MinusCircleIcon, NotApplicable: MinusCircleOutlineIcon};

// Blame sources that originate at (or below) the editing scope and are
// safe to expose detail about in the chip tooltip. Upper-scoped sources
// (system_permission, channel_policy) are deliberately omitted — the
// public-server's privacy boundary strips their expression/tree, and
// the chip-level rule/policy-name leak should follow the same rule.
const SAME_SCOPE_BLAME_SOURCES = new Set<string>([
    POLICY_SIMULATION_BLAME_SOURCES.THIS_RULE,
    POLICY_SIMULATION_BLAME_SOURCES.SIBLING_RULE,
    POLICY_SIMULATION_BLAME_SOURCES.SIBLING_SAVED,
    POLICY_SIMULATION_BLAME_SOURCES.PEER_POLICY,
]);

function hasBlame(blame: PolicySimulationBlame[] | undefined, source: string): boolean {
    if (!blame || blame.length === 0) {
        return false;
    }

    // Match deny-style entries only — informational allow entries
    // don't contribute to "is this NO_APPLICABLE_POLICY / SIBLING_SAVED"
    // reasoning the chip layer uses. (Same backward-compat handling
    // for empty `outcome` as pickPrimaryDenyBlame.)
    return blame.some((b) => b.source === source && b.outcome !== 'allow');
}

function pickPrimaryDenyBlame(blame: PolicySimulationBlame[] | undefined): PolicySimulationBlame | undefined {
    if (!blame || blame.length === 0) {
        return undefined;
    }

    // Skip informational allow entries the simulator emits to surface
    // the editing draft's evaluation when a peer policy is the actual
    // denier — the chip is supposed to name the denier, not the
    // "I allowed" companion entry. Empty `outcome` defaults to deny
    // for backward compat with older simulators.
    const denyOnly = blame.filter((b) => b.outcome !== 'allow');
    if (denyOnly.length === 0) {
        return undefined;
    }
    let best: PolicySimulationBlame | undefined;
    let bestRank = DENY_BLAME_PRIORITY.length;
    for (const b of denyOnly) {
        const rank = DENY_BLAME_PRIORITY.indexOf(b.source);
        if (rank === -1 || rank >= bestRank) {
            continue;
        }
        best = b;
        bestRank = rank;
    }
    return best ?? denyOnly[0];
}

function blameSourceLabel(
    blame: PolicySimulationBlame,
    formatMessage: ReturnType<typeof useIntl>['formatMessage'],
): string {
    // Peer-policy blame surfaces the actual policy name on the chip
    // (e.g. "Denied · IL5 Block") because at the editing scope peers
    // are visible and naming them is useful. Falls back to the generic
    // "peer policy" label only when the simulator didn't include a
    // policy name.
    if (blame.source === POLICY_SIMULATION_BLAME_SOURCES.PEER_POLICY && blame.policy_name) {
        return blame.policy_name;
    }
    const sourceMsg = blameSourceMessages[blame.source as keyof typeof blameSourceMessages];
    if (!sourceMsg) {
        return blame.source;
    }
    return formatMessage(sourceMsg);
}
