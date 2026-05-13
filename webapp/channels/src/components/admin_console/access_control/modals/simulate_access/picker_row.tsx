// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useCallback, useMemo, useState} from 'react';
import {FormattedMessage} from 'react-intl';

import type {AccessControlPolicy, PolicySimulationActionDecision} from '@mattermost/types/access_control';
import {POLICY_SIMULATION_BLAME_SOURCES} from '@mattermost/types/access_control';
import type {UserPropertyField} from '@mattermost/types/properties';

import {Client4} from 'mattermost-redux/client';
import {displayUsername} from 'mattermost-redux/utils/user_utils';

import ProfilePicture from 'components/profile_picture';

import Constants from 'utils/constants';
import {isKeyPressed} from 'utils/keyboard';

import {AGGREGATE_DECISION_STATE, aggregateDecisions} from './decision_aggregate';
import DecisionChip from './decision_chip';
import DecisionDetailsModal from './decision_details_modal';
import SessionAttributeEditorButton from './session_attribute_editor';
import SessionRow from './session_row';
import StackedDecisionChip from './stacked_decision_chip';
import type {RowState, UserDecisionsBundle} from './types';

import './picker_row.scss';

type Props = {
    row: RowState;
    actions: string[];
    actionLabels?: Record<string, string>;
    pending: boolean;
    bundle?: UserDecisionsBundle;

    /** Draft policy currently being edited. Forwarded to
     *  DecisionDetailsModal so it can fall back to a client-side
     *  expression lookup for draft-side blame entries when the
     *  simulator didn't pre-populate `blame.expression`. */
    policy: AccessControlPolicy;

    /** Session-attribute property fields used to render the pencil-icon
     *  override editor. Empty array → pencil button is hidden. */
    sessionAttributeFields: UserPropertyField[];
    sessionAttributesEnabled: boolean;
    expanded: boolean;
    onToggleExpand: (userId: string) => void;
    onApplyOverrides: (userId: string, overrides: Record<string, string>) => void;
};

/**
 * One staged user in the picker. Renders the user's avatar/name, an
 * aggregate decision chip (or stacked chip for multi-action rules),
 * the optional recent-activity summary, and the pencil/remove
 * affordances on the right. Clicking the row toggles the per-session
 * unfold when sessions are configured; clicking the chip opens
 * DecisionDetailsModal with the per-action breakdown + evaluation
 * trace.
 */
export default function PickerRow({
    row,
    actions,
    actionLabels,
    pending,
    bundle,
    policy,
    sessionAttributeFields,
    sessionAttributesEnabled,
    expanded,
    onToggleExpand,
    onApplyOverrides,
}: Props): JSX.Element {
    const {user} = row;
    const [showDetails, setShowDetails] = useState(false);

    const handleOpenDetails = useCallback(() => {
        setShowDetails(true);
    }, []);

    const handleCloseDetails = useCallback(() => {
        setShowDetails(false);
    }, []);

    const handleChipButtonClick = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
        // The chip lives inside the (mouse-clickable) row, so stop the
        // click from bubbling up to the row's expand handler.
        e.stopPropagation();
        setShowDetails(true);
    }, []);

    const stopRowPropagation = useCallback((e: React.MouseEvent<HTMLElement>) => {
        e.stopPropagation();
    }, []);

    // Single-action rows render the regular DecisionChip directly so the
    // per-rule blame label stays visible without a click. Multi-action
    // rows collapse to a stacked Allowed/Mixed/Denied chip and reveal
    // the per-action breakdown via DecisionDetailsModal.
    const aggregate = useMemo(
        () => aggregateDecisions(actions, bundle?.decisions, pending),
        [actions, bundle, pending],
    );

    // For single-action rows the chip is the only deny affordance, so
    // wrap it in a button when there's something to drill into. We open
    // the same DecisionDetailsModal the multi-action stacked chip uses,
    // just with one action in the body — that's the canonical "Why
    // denied?" surface across the picker.
    const chipNode = useMemo(() => {
        if (actions.length <= 1) {
            const action = actions[0];
            const decision = action ? bundle?.decisions?.[action] : undefined;
            const chip = (
                <DecisionChip
                    decision={decision}
                    pending={pending}
                />
            );
            const drillable = !pending && shouldShowDecisionDetails(decision);
            if (!drillable) {
                return chip;
            }
            return (
                <button
                    type='button'
                    className='SimulateAccessModal__rowChipButton'
                    data-testid='simulate-access-row-chip-button'
                    onClick={handleChipButtonClick}
                >
                    {chip}
                </button>
            );
        }
        return (
            <StackedDecisionChip
                state={aggregate}
                count={actions.length}
                onClick={handleOpenDetails}
            />
        );
    }, [actions, aggregate, bundle, pending, handleChipButtonClick, handleOpenDetails]);

    const sessionsCount = bundle?.sessions?.length ?? 0;
    const deniedSessionsCount = useMemo(() => {
        if (!bundle?.sessions) {
            return 0;
        }
        let count = 0;
        for (const s of bundle.sessions) {
            const state = aggregateDecisions(actions, s.decisions, false);
            if (state === AGGREGATE_DECISION_STATE.DENIED || state === AGGREGATE_DECISION_STATE.MIXED) {
                count++;
            }
        }
        return count;
    }, [bundle, actions]);

    // The recent-activity column reads "X sessions" when every session
    // resolves the same way, or "Y of X sessions" when some sessions
    // denied (so the author can spot mixed-result users at a glance).
    const recentActivityLabel = useMemo(() => {
        if (sessionsCount === 0) {
            return null;
        }
        if (deniedSessionsCount > 0 && deniedSessionsCount < sessionsCount) {
            return (
                <FormattedMessage
                    id='admin.access_control.simulate_access.activity.partial'
                    defaultMessage='{denied} of {total, plural, one {# session} other {# sessions}}'
                    values={{denied: deniedSessionsCount, total: sessionsCount}}
                />
            );
        }
        return (
            <FormattedMessage
                id='admin.access_control.simulate_access.activity.total'
                defaultMessage='{total, plural, one {# session} other {# sessions}}'
                values={{total: sessionsCount}}
            />
        );
    }, [sessionsCount, deniedSessionsCount]);

    // Per-session expand only makes sense when the deployment has
    // configured session-attribute fields — otherwise the unfold UI
    // would misalign with the parent table (RECENT ACTIVITY column is
    // hidden) and there's nothing meaningful for the author to inspect.
    const expandable = sessionAttributesEnabled && sessionsCount > 0;

    const handleToggle = useCallback(() => {
        onToggleExpand(user.id);
    }, [onToggleExpand, user.id]);

    const handleActivityButtonClick = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
        // The whole row is also clickable as a mouse convenience, so
        // stop the button's click from bubbling up and toggling twice.
        e.stopPropagation();
        onToggleExpand(user.id);
    }, [onToggleExpand, user.id]);

    const handleActivityButtonKeyDown = useCallback((e: React.KeyboardEvent<HTMLButtonElement>) => {
        // Space defaults to scrolling the modal body — intercept both
        // Enter and Space so the activity button activates like a real
        // disclosure widget.
        if (isKeyPressed(e, Constants.KeyCodes.ENTER) || isKeyPressed(e, Constants.KeyCodes.SPACE)) {
            e.preventDefault();
            onToggleExpand(user.id);
        }
    }, [onToggleExpand, user.id]);

    return (
        <>
            <tr
                className={classNames('SimulateAccessModal__row', {
                    'SimulateAccessModal__row--expandable': expandable,
                    'SimulateAccessModal__row--expanded': expanded,
                })}

                // Mouse convenience only: clicking anywhere on the row
                // toggles the per-session unfold. Screen-reader and
                // keyboard users interact via the explicit
                // disclosure button rendered inside the activity cell
                // (`<tr role="button">` confuses assistive tech because
                // it strips the cells' row semantics).
                onClick={expandable ? handleToggle : undefined}
            >
                <td className='SimulateAccessModal__rowUser'>
                    <div className='SimulateAccessModal__rowAvatar'>
                        <ProfilePicture
                            src={Client4.getProfilePictureUrl(user.id, user.last_picture_update)}
                            userId={user.id}
                            username={user.username}
                            size='md'
                        />
                    </div>
                    <div className='SimulateAccessModal__rowName'>
                        <span
                            className='SimulateAccessModal__rowDisplayName'
                            title={displayUsername(user, 'full_name')}
                        >{displayUsername(user, 'full_name')}</span>
                        <span
                            className='SimulateAccessModal__rowUsername'
                            title={`@${user.username}`}
                        >{`@${user.username}`}</span>
                    </div>
                </td>
                <td className='SimulateAccessModal__rowResult'>
                    {chipNode}
                </td>
                {sessionAttributesEnabled ? (
                    <td className='SimulateAccessModal__rowActivity'>
                        {recentActivityLabel ? (
                            <button
                                type='button'
                                className='SimulateAccessModal__rowActivityLabel'
                                aria-expanded={expanded}
                                onClick={handleActivityButtonClick}
                                onKeyDown={handleActivityButtonKeyDown}
                            >
                                {recentActivityLabel}
                                <i
                                    className={classNames('icon', {
                                        'icon-chevron-up': expanded,
                                        'icon-chevron-down': !expanded,
                                    })}
                                    aria-hidden='true'
                                />
                            </button>
                        ) : (
                            <span className='SimulateAccessModal__rowActivityEmpty'>{'—'}</span>
                        )}
                    </td>
                ) : null}
                {sessionAttributesEnabled ? (
                    <td
                        className='SimulateAccessModal__rowActions'

                        // Stop row-click propagation so clicking the
                        // pencil button doesn't also expand/collapse.
                        onClick={stopRowPropagation}
                    >
                        <SessionAttributeEditorButton
                            userId={user.id}
                            displayName={displayUsername(user, 'full_name') || user.username}
                            fields={sessionAttributeFields}
                            currentOverrides={row.sessionOverrides}
                            onApply={onApplyOverrides}
                        />
                    </td>
                ) : null}
            </tr>
            {expanded && bundle?.sessions ? (
                bundle.sessions.map((session, idx) => (
                    <SessionRow
                        key={session.id || `${user.id}-session-${idx}`}
                        session={session}
                        actions={actions}
                    />
                ))
            ) : null}
            {showDetails ? (
                <DecisionDetailsModal
                    onExited={handleCloseDetails}
                    user={user}
                    actions={actions}
                    actionLabels={actionLabels}
                    decisions={bundle?.decisions}
                    pending={pending}
                    policy={policy}
                    userAttributes={bundle?.attributes}
                />
            ) : null}
        </>
    );
}

/**
 * Returns true when a single-action chip should open
 * DecisionDetailsModal on click. We surface details for outcomes where
 * the modal has something useful to say:
 *   - Denies: rule + expression + attribute trace.
 *   - Allows whose only blame is `sibling_saved`: surfaces the rule
 *     that flipped a draft-side deny back to allow.
 *
 * Pending, plain-allow (no blame) and not-applicable chips stay
 * static — there's nothing the modal would show beyond the chip
 * itself.
 */
function shouldShowDecisionDetails(decision: PolicySimulationActionDecision | undefined): boolean {
    if (!decision) {
        return false;
    }
    if (!decision.decision) {
        return true;
    }
    if (!decision.blame) {
        return false;
    }

    // Skip informational allow entries — only deny-side SIBLING_SAVED
    // blame should make the row eligible for the details drill-down.
    return decision.blame.some(
        (b) => b.source === POLICY_SIMULATION_BLAME_SOURCES.SIBLING_SAVED && b.outcome !== 'allow',
    );
}
