// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect} from 'react';

import {useIntl, FormattedMessage} from 'react-intl';

import {useSelector, useDispatch} from 'react-redux';

import {Permissions} from 'mattermost-redux/constants';

import {GlobalState} from 'types/store';

import {getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';
import {DispatchFunc} from 'mattermost-redux/types/actions';

import {getTotalUsersStats} from 'mattermost-redux/actions/users';

import {trackEvent} from 'actions/telemetry_actions';

import ToggleModalButton from 'components/toggle_modal_button';
import InvitationModal from 'components/invitation_modal';
import TeamPermissionGate from 'components/permissions_gates/team_permission_gate';
import {getAnalyticsCategory} from 'components/onboarding_tasks';

import Constants, {ModalIdentifiers} from 'utils/constants';

type Props = {
    touchedInviteMembersButton: boolean;
    className?: string;
    onClick: () => void;
    isAdmin: boolean;
}

const InviteMembersButton: React.FC<Props> = (props: Props): JSX.Element | null => {
    const dispatch = useDispatch<DispatchFunc>();

    const intl = useIntl();
    const currentTeamId = useSelector(getCurrentTeamId);
    const totalUserCount = useSelector((state: GlobalState) => state.entities.users.stats?.total_users_count);

    useEffect(() => {
        if (!totalUserCount) {
            dispatch(getTotalUsersStats());
        }
    }, []);

    const handleButtonClick = () => {
        trackEvent(getAnalyticsCategory(props.isAdmin), 'click_sidebar_invite_members_button');
        props.onClick();
    };

    let buttonClass = 'SidebarChannelNavigator_inviteMembersLhsButton';

    if (!props.touchedInviteMembersButton && Number(totalUserCount) <= Constants.USER_LIMIT) {
        buttonClass += ' SidebarChannelNavigator_inviteMembersLhsButton--untouched';
    }

    if (!currentTeamId || !totalUserCount) {
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
