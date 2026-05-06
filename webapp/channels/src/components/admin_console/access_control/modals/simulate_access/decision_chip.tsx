// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {defineMessages, FormattedMessage, useIntl} from 'react-intl';

import type {PolicySimulationActionDecision, PolicySimulationBlame} from '@mattermost/types/access_control';
import {POLICY_SIMULATION_BLAME_SOURCES} from '@mattermost/types/access_control';

const blameSourceMessages = defineMessages({
    [POLICY_SIMULATION_BLAME_SOURCES.THIS_RULE]: {
        id: 'admin.access_control.simulate_access.blame.this_rule',
        defaultMessage: 'this rule',
    },
    [POLICY_SIMULATION_BLAME_SOURCES.SIBLING_RULE]: {
        id: 'admin.access_control.simulate_access.blame.sibling_rule',
        defaultMessage: 'sibling rule',
    },
    [POLICY_SIMULATION_BLAME_SOURCES.CHANNEL_POLICY]: {
        id: 'admin.access_control.simulate_access.blame.channel_policy',
        defaultMessage: 'channel policy',
    },
    [POLICY_SIMULATION_BLAME_SOURCES.SYSTEM_PERMISSION]: {
        id: 'admin.access_control.simulate_access.blame.system_permission',
        defaultMessage: 'upper-scoped policy',
    },
    [POLICY_SIMULATION_BLAME_SOURCES.NO_APPLICABLE_POLICY]: {
        id: 'admin.access_control.simulate_access.blame.no_applicable_policy',
        defaultMessage: "policy doesn't apply to this user",
    },
    [POLICY_SIMULATION_BLAME_SOURCES.SIBLING_SAVED]: {
        id: 'admin.access_control.simulate_access.blame.sibling_saved',
        defaultMessage: 'sibling rule',
    },
});

type Props = {
    decision: PolicySimulationActionDecision | undefined;
    pending?: boolean;
};

/**
 * Per-user, per-action decision chip.
 *
 * The chip renders the blame source inline (e.g. "Denied · this rule"
 * rather than a tooltip-only hint) so authors can scan the list and tell
 * at a glance whether a deny is coming from the rule they're editing, a
 * sibling rule, or an upper-scoped system policy.
 *
 * States:
 *   - pending → grey "Evaluating…" while a simulate dispatch is in flight.
 *   - ALLOW with sibling_saved blame → green "Allowed · sibling rule"
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
                    <FormattedMessage {...blameSourceMessages[POLICY_SIMULATION_BLAME_SOURCES.NO_APPLICABLE_POLICY]}/>
                </span>
            );
        }

        // ALLOW with sibling_saved blame: the editing rule alone would
        // have denied. Surface that inline so authors can spot
        // "OR-saved" allows.
        if (hasBlame(decision.blame, POLICY_SIMULATION_BLAME_SOURCES.SIBLING_SAVED)) {
            return (
                <span
                    className='SimulateAccessModal__rowChip SimulateAccessModal__rowChip--allow-saved'
                    data-testid='simulate-access-row-chip-allow-saved'
                >
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
                <FormattedMessage
                    id='admin.access_control.simulate_access.chip.allow'
                    defaultMessage='Allowed'
                />
            </span>
        );
    }

    const blame = decision.blame?.[0];
    const blameLabel = blame ? blameSourceLabel(blame, formatMessage) : '';

    return (
        <span
            className='SimulateAccessModal__rowChip SimulateAccessModal__rowChip--deny'
            data-testid='simulate-access-row-chip-deny'
            title={blame?.rule_name || blame?.policy_name || ''}
        >
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

function hasBlame(blame: PolicySimulationBlame[] | undefined, source: string): boolean {
    if (!blame || blame.length === 0) {
        return false;
    }
    return blame.some((b) => b.source === source);
}

function blameSourceLabel(
    blame: PolicySimulationBlame,
    formatMessage: ReturnType<typeof useIntl>['formatMessage'],
): string {
    const sourceMsg = blameSourceMessages[blame.source as keyof typeof blameSourceMessages];
    if (!sourceMsg) {
        return blame.source;
    }
    return formatMessage(sourceMsg);
}
