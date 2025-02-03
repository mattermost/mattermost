// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl, FormattedMessage} from 'react-intl';
import {useSelector} from 'react-redux';

import {Permissions} from 'mattermost-redux/constants';
import {getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';

import {trackEvent} from 'actions/telemetry_actions';

import InvitationModal from 'components/invitation_modal';
import {getAnalyticsCategory} from 'components/onboarding_tasks';
import TeamPermissionGate from 'components/permissions_gates/team_permission_gate';
import ToggleModalButton from 'components/toggle_modal_button';

import {ModalIdentifiers} from 'utils/constants';

type Props = {
    className?: string;
    isAdmin: boolean;
}

const InviteMembersButton = (props: Props): JSX.Element | null => {
    const intl = useIntl();
    const currentTeamId = useSelector(getCurrentTeamId);

    const handleButtonClick = () => {
        trackEvent(getAnalyticsCategory(props.isAdmin), 'click_sidebar_invite_members_button');
    };

    if (!currentTeamId) {
        return null;
    }

    return (
        <TeamPermissionGate
            teamId={currentTeamId}
            permissions={[Permissions.ADD_USER_TO_TEAM, Permissions.INVITE_GUEST]}
        >
            <ToggleModalButton
                ariaLabel={intl.formatMessage({id: 'sidebar_left.inviteMembers', defaultMessage: 'Invite Members'})}
                id='inviteMembersButton'
                className={`intro-links color--link cursor--pointer${props.className ? ` ${props.className}` : ''}`}
                modalId={ModalIdentifiers.INVITATION}
                dialogType={InvitationModal}
                onClick={handleButtonClick}
            >
                <div
                    className='SidebarChannelNavigator__inviteMembersLhsButton'
                    aria-label={intl.formatMessage({id: 'sidebar_left.sidebar_channel_navigator.inviteUsers', defaultMessage: 'Invite Members'})}
                >
                    <i
                        className='icon-plus-box'
                        aria-hidden='true'
                    />
                    <FormattedMessage
                        id={'sidebar_left.inviteMembers'}
                        defaultMessage='Invite Members'
                    />
                </div>
            </ToggleModalButton>
        </TeamPermissionGate>
    );
};

export default InviteMembersButton;
