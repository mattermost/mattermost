// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import type {AggregateDecisionState} from './decision_aggregate';

import './decision_chip.scss';

const sessionStateClass: Record<AggregateDecisionState, string> = {
    pending: 'SimulateAccessModal__rowChip--pending',
    'not-applicable': 'SimulateAccessModal__rowChip--not-applicable',
    allowed: 'SimulateAccessModal__rowChip--allow',
    denied: 'SimulateAccessModal__rowChip--deny',
    mixed: 'SimulateAccessModal__rowChip--mixed',
};

type Props = {
    state: AggregateDecisionState;
};

/**
 * Static (non-clickable) chip used inside the per-session unfold rows.
 * Sessions intentionally render a single aggregate verdict — we don't
 * stack permission counts here; multi-permission rollups live on the
 * parent row's StackedDecisionChip and the breakdown modal.
 */
export default function SessionStateChip({state}: Props): JSX.Element {
    const label = sessionStateLabel(state);
    return (
        <span
            className={`SimulateAccessModal__rowChip ${sessionStateClass[state]}`}
            data-testid={`simulate-access-session-chip-${state}`}
        >
            {label}
        </span>
    );
}

/**
 * Compact label for an aggregate decision state. Exported because the
 * multi-action StackedDecisionChip on the parent row reuses the same
 * wording — keeping the single source means a label rename touches one
 * file.
 */
export function sessionStateLabel(state: AggregateDecisionState): JSX.Element {
    switch (state) {
    case 'pending':
        return (
            <FormattedMessage
                id='admin.access_control.simulate_access.chip.pending'
                defaultMessage='Evaluating…'
            />
        );
    case 'not-applicable':
        return (
            <FormattedMessage
                id='admin.access_control.simulate_access.chip.stacked.not_applicable'
                defaultMessage="Policy doesn't apply"
            />
        );
    case 'allowed':
        return (
            <FormattedMessage
                id='admin.access_control.simulate_access.chip.stacked.allowed'
                defaultMessage='Allowed'
            />
        );
    case 'denied':
        return (
            <FormattedMessage
                id='admin.access_control.simulate_access.chip.stacked.denied'
                defaultMessage='Denied'
            />
        );
    case 'mixed':
    default:
        return (
            <FormattedMessage
                id='admin.access_control.simulate_access.chip.stacked.mixed'
                defaultMessage='Mixed'
            />
        );
    }
}
