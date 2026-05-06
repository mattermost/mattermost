// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import {GenericModal} from '@mattermost/components';
import type {PolicySimulationActionDecision} from '@mattermost/types/access_control';
import type {UserProfile} from '@mattermost/types/users';

import {Client4} from 'mattermost-redux/client';
import {displayUsername} from 'mattermost-redux/utils/user_utils';

import ProfilePicture from 'components/profile_picture';

import DecisionChip from './decision_chip';

type Props = {
    onExited: () => void;
    user: UserProfile;
    actions: string[];
    actionLabels?: Record<string, string>;
    decisions?: Record<string, PolicySimulationActionDecision>;
    pending: boolean;
};

/**
 * Stacked sub-modal that breaks a row's aggregate chip down to the
 * per-permission decisions. Mounted with `isStacked={true}` so it sits
 * above the main SimulateAccessModal without dismounting it. Read-only —
 * decisions are passed in by the picker; the modal doesn't re-dispatch
 * the simulator.
 *
 * Layout:
 *   - Header: avatar + display name + @username so the author can keep
 *     track of which row they drilled into.
 *   - Body: one row per action with the action label and a DecisionChip
 *     mirroring whatever the row would show if it weren't stacked. The
 *     chip already renders blame source inline (e.g. "Denied · this rule"),
 *     so this view is essentially "expand the stack".
 */
export default function PermissionBreakdownModal({
    onExited,
    user,
    actions,
    actionLabels,
    decisions,
    pending,
}: Props): JSX.Element {
    const {formatMessage} = useIntl();

    return (
        <GenericModal
            id='simulateAccessPermissionBreakdownModal'
            className='SimulateAccessModal__breakdown a11y__modal'
            show={true}
            onHide={onExited}
            onExited={onExited}
            isStacked={true}
            compassDesign={true}
            showCloseButton={true}
            bodyPadding={true}
            ariaLabel={formatMessage({
                id: 'admin.access_control.simulate_access.breakdown.title',
                defaultMessage: 'Permission decisions',
            })}
            modalHeaderText={
                <FormattedMessage
                    id='admin.access_control.simulate_access.breakdown.title'
                    defaultMessage='Permission decisions'
                />
            }
        >
            <div className='SimulateAccessModal__breakdownHeader'>
                {/* ProfilePicture with userId opens the standard profile
                  * popover on click — matches the affordance from the
                  * picker row so authors can drill into attribute/role
                  * details from this drilled-down view too. */}
                <div className='SimulateAccessModal__breakdownAvatar'>
                    <ProfilePicture
                        src={Client4.getProfilePictureUrl(user.id, user.last_picture_update)}
                        userId={user.id}
                        username={user.username}
                        size='lg'
                    />
                </div>
                <div className='SimulateAccessModal__breakdownIdentity'>
                    <span className='SimulateAccessModal__breakdownDisplayName'>
                        {displayUsername(user, 'full_name') || user.username}
                    </span>
                    <span className='SimulateAccessModal__breakdownUsername'>{`@${user.username}`}</span>
                </div>
            </div>
            <ul className='SimulateAccessModal__breakdownList'>
                {actions.map((action) => (
                    <li
                        key={action}
                        className='SimulateAccessModal__breakdownItem'
                        data-testid={`simulate-access-breakdown-${action}`}
                    >
                        <span className='SimulateAccessModal__breakdownItemLabel'>
                            {actionLabels?.[action] ?? action}
                        </span>
                        <DecisionChip
                            decision={decisions?.[action]}
                            pending={pending}
                        />
                    </li>
                ))}
            </ul>
        </GenericModal>
    );
}
