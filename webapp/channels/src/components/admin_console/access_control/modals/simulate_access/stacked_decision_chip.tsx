// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type IconProps from '@mattermost/compass-icons/components/props';

import type {AggregateDecisionState} from './decision_aggregate';
import {ChipIcon} from './decision_chip';
import {sessionStateLabel} from './session_state_chip';

import './decision_chip.scss';

const stackedStateModifier: Record<AggregateDecisionState, string> = {
    pending: 'SimulateAccessModal__rowChip--pending',
    'not-applicable': 'SimulateAccessModal__rowChip--not-applicable',
    allowed: 'SimulateAccessModal__rowChip--allow',
    denied: 'SimulateAccessModal__rowChip--deny',
    mixed: 'SimulateAccessModal__rowChip--mixed',
};

const stackedStateTestId: Record<AggregateDecisionState, string> = {
    pending: 'simulate-access-row-chip-stacked-pending',
    'not-applicable': 'simulate-access-row-chip-stacked-not-applicable',
    allowed: 'simulate-access-row-chip-stacked-allow',
    denied: 'simulate-access-row-chip-stacked-deny',
    mixed: 'simulate-access-row-chip-stacked-mixed',
};

// Match each aggregate state to the same filled-circle glyph the
// single-action chip uses (see ChipIcon in decision_chip.tsx) so the
// stacked rollup pill and the per-action pill it expands into share
// a visual language. Pending stays icon-less — adding a circle there
// would compete with the spinner the row already shows. Typed against
// the upstream `IconProps` so the assignment from compass-icons FCs
// stays exact rather than requiring a structural prop subset.
const stackedStateIcon: Record<AggregateDecisionState, React.ComponentType<IconProps> | null> = {
    pending: null,
    'not-applicable': ChipIcon.NotApplicable,
    allowed: ChipIcon.Allow,
    denied: ChipIcon.Deny,
    mixed: ChipIcon.Mixed,
};

type Props = {
    state: AggregateDecisionState;
    count: number;
    onClick: () => void;
};

/**
 * Multi-action rollup chip on the parent row. Clicking opens
 * DecisionDetailsModal so the author can drill into per-permission
 * decisions, the failing rule, and the attribute snapshot. The label
 * is intentionally compact ("Allowed", "Denied", "Mixed") because the
 * actual blame attribution lives in the details modal — we don't want
 * to lose information, just defer it from the row scan.
 */
export default function StackedDecisionChip({state, count, onClick}: Props): JSX.Element {
    const label = sessionStateLabel(state);
    const Icon = stackedStateIcon[state];
    return (
        <button
            type='button'
            className={`SimulateAccessModal__rowChip SimulateAccessModal__rowChip--stacked ${stackedStateModifier[state]}`}
            data-testid={stackedStateTestId[state]}
            onClick={(e) => {
                e.stopPropagation();
                onClick();
            }}
            disabled={state === 'pending'}
        >
            {Icon ? (
                <Icon
                    size={14}
                    className='SimulateAccessModal__rowChipIcon'
                />
            ) : null}
            <span className='SimulateAccessModal__rowChipLabel'>{label}</span>
            <span className='SimulateAccessModal__rowChipCount'>{count}</span>
            <i
                className='icon icon-chevron-right SimulateAccessModal__rowChipChevron'
                aria-hidden='true'
            />
        </button>
    );
}
