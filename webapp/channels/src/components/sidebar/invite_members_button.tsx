// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {useIntl, FormattedMessage} from 'react-intl';

import {useSelector} from 'react-redux';

import {Permissions} from 'mattermost-redux/constants';

import {getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';

import {trackEvent} from 'actions/telemetry_actions';

import ToggleModalButton from 'components/toggle_modal_button';
import InvitationModal from 'components/invitation_modal';
import TeamPermissionGate from 'components/permissions_gates/team_permission_gate';
import {getAnalyticsCategory} from 'components/onboarding_tasks';

import {ModalIdentifiers} from 'utils/constants';

type Props = {
    touchedInviteMembersButton: boolean;
    className?: string;
    onClick: () => void;
    isAdmin: boolean;
}

const InviteMembersButton = (props: Props): JSX.Element | null => {
    const intl = useIntl();
    const currentTeamId = useSelector(getCurrentTeamId);

    const handleButtonClick = () => {
        trackEvent(getAnalyticsCategory(props.isAdmin), 'click_sidebar_invite_members_button');
        props.onClick();
    };

    let buttonClass = 'SidebarChannelNavigator__inviteMembersLhsButton';

    if (!props.touchedInviteMembersButton) {
        buttonClass += ' SidebarChannelNavigator__inviteMembersLhsButton--untouched';
    }

    if (!currentTeamId) {
        return null;
    }

    return (
        <TeamPermissionGate
            teamId={currentTeamId}
            permissions={[Permissions.ADD_USER_TO_TEAM, Permissions.INVITE_GUEST]}
        >
            <ToggleModalButton
                ariaLabel={intl.formatMessage({id: 'sidebar_left.inviteUsers', defaultMessage: 'Invite Users'})}
                id='introTextInvite'
                className={`intro-links color--link cursor--pointer${props.className ? ` ${props.className}` : ''}`}
                modalId={ModalIdentifiers.INVITATION}
                dialogType={InvitationModal}
                onClick={handleButtonClick}
            >
                <li
                    className={buttonClass}
                    aria-label={intl.formatMessage({id: 'sidebar_left.sidebar_channel_navigator.inviteUsers', defaultMessage: 'Invite Members'})}
                >
                    <i className='icon-plus-box'/>
                    <FormattedMessage
                        id={'sidebar_left.inviteMembers'}
                        defaultMessage='Invite Members'
                    />
                </li>
            </ToggleModalButton>
        </TeamPermissionGate>
    );
};

export default InviteMembersButton;
