// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useSelector} from 'react-redux';

import {Permissions} from 'mattermost-redux/constants';
import {getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';

import {trackEvent} from 'actions/telemetry_actions';

import AddGroupsToChannelModal from 'components/add_groups_to_channel_modal';
import ChannelInviteModal from 'components/channel_invite_modal';
import EmptyStateThemeableSvg from 'components/common/svg_images_components/empty_state_themeable_svg';
import InvitationModal from 'components/invitation_modal';
import ChannelPermissionGate from 'components/permissions_gates/channel_permission_gate';
import TeamPermissionGate from 'components/permissions_gates/team_permission_gate';
import ToggleModalButton from 'components/toggle_modal_button';
import LoadingSpinner from 'components/widgets/loading/loading_spinner';

import {Constants, ModalIdentifiers} from 'utils/constants';
import {localizeMessage} from 'utils/utils';

import type {Channel} from '@mattermost/types/channels';

import './add_members_button.scss';

export interface AddMembersButtonProps {
    totalUsers?: number;
    usersLimit: number;
    channel: Channel;
    setHeader?: React.ReactNode;
    pluginButtons?: React.ReactNode;
}

const AddMembersButton: React.FC<AddMembersButtonProps> = ({totalUsers, usersLimit, channel, setHeader, pluginButtons}: AddMembersButtonProps) => {
    const currentTeamId = useSelector(getCurrentTeamId);

    if (!totalUsers) {
        return (<LoadingSpinner/>);
    }

    const isPrivate = channel.type === Constants.PRIVATE_CHANNEL;
    const inviteUsers = totalUsers < usersLimit;

    return (
        <TeamPermissionGate
            teamId={currentTeamId}
            permissions={[Permissions.ADD_USER_TO_TEAM, Permissions.INVITE_GUEST]}
        >
            {inviteUsers && !isPrivate ? (
                <LessThanMaxFreeUsers
                    pluginButtons={pluginButtons}
                    setHeader={setHeader}
                />
            ) : (
                <MoreThanMaxFreeUsers
                    channel={channel}
                    pluginButtons={pluginButtons}
                    setHeader={setHeader}
                />
            )}
        </TeamPermissionGate>
    );
};

const LessThanMaxFreeUsers = ({setHeader, pluginButtons}: {setHeader: React.ReactNode; pluginButtons: React.ReactNode}) => {
    const {formatMessage} = useIntl();

    return (
        <>
            {pluginButtons}
            {setHeader}
            <div className='LessThanMaxFreeUsers'>
                <EmptyStateThemeableSvg
                    width={128}
                    height={113}
                />
                <div className='titleAndButton'>
                    <FormattedMessage
                        id='intro_messages.inviteOthersToWorkspace.title'
                        defaultMessage='Let’s add some people to the workspace!'
                    />
                    <ToggleModalButton
                        ariaLabel={localizeMessage('intro_messages.inviteOthers', 'Invite others to the workspace')}
                        id='introTextInvite'
                        className='intro-links color--link cursor--pointer'
                        modalId={ModalIdentifiers.INVITATION}
                        dialogType={InvitationModal}
                        onClick={() => trackEvent('channel_intro_message', 'click_invite_button')}
                    >
                        <i
                            className='icon-email-plus-outline'
                            title={formatMessage({id: 'generic_icons.add', defaultMessage: 'Add Icon'})}
                        />
                        <FormattedMessage
                            id='intro_messages.inviteOthersToWorkspace.button'
                            defaultMessage='Invite others to the workspace'
                        />
                    </ToggleModalButton>
                </div>
            </div>
        </>
    );
};

const MoreThanMaxFreeUsers = ({channel, setHeader, pluginButtons}: {channel: Channel; setHeader: React.ReactNode; pluginButtons: React.ReactNode}) => {
    const {formatMessage} = useIntl();

    const modalId = channel.group_constrained ? ModalIdentifiers.ADD_GROUPS_TO_CHANNEL : ModalIdentifiers.CHANNEL_INVITE;
    const modal = channel.group_constrained ? AddGroupsToChannelModal : ChannelInviteModal;
    const channelIsArchived = channel.delete_at !== 0;
    if (channelIsArchived) {
        return null;
    }
    const isPrivate = channel.type === Constants.PRIVATE_CHANNEL;

    return (
        <div className='MoreThanMaxFreeUsersWrapper'>
            <div className='MoreThanMaxFreeUsers'>
                <ChannelPermissionGate
                    channelId={channel.id}
                    teamId={channel.team_id}
                    permissions={[isPrivate ? Permissions.MANAGE_PRIVATE_CHANNEL_MEMBERS : Permissions.MANAGE_PUBLIC_CHANNEL_MEMBERS]}
                >
                    <ToggleModalButton
                        className='intro-links color--link'
                        modalId={modalId}
                        dialogType={modal}
                        dialogProps={{channel}}
                    >
                        <i
                            className='icon-account-plus-outline'
                            title={formatMessage({id: 'generic_icons.add', defaultMessage: 'Add Icon'})}
                        />
                        {isPrivate && channel.group_constrained &&
                            <FormattedMessage
                                id='intro_messages.inviteGropusToChannel.button'
                                defaultMessage='Add groups to this private channel'
                            />}
                        {isPrivate && !channel.group_constrained &&
                            <FormattedMessage
                                id='intro_messages.inviteMembersToPrivateChannel.button'
                                defaultMessage='Add members to this private channel'
                            />}
                        {!isPrivate &&
                            <FormattedMessage
                                id='intro_messages.inviteMembersToChannel.button'
                                defaultMessage='Add members to this channel'
                            />}
                    </ToggleModalButton>
                </ChannelPermissionGate>
            </div>
            {pluginButtons}
            {setHeader}
        </div>
    );
};

export default React.memo(AddMembersButton);
