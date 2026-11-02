// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import {AccountPlusOutlineIcon} from '@mattermost/compass-icons/components';
import {Icon} from '@mattermost/compass-ui/components/icon';
import {TileButton} from '@mattermost/compass-ui/components/tile-button';
import type {Channel} from '@mattermost/types/channels';

import {Permissions} from 'mattermost-redux/constants';
import {getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';

import {openModal} from 'actions/views/modals';

import AddGroupsToChannelModal from 'components/add_groups_to_channel_modal';
import ChannelInviteModal from 'components/channel_invite_modal';
import InvitationModal from 'components/invitation_modal';
import ChannelPermissionGate from 'components/permissions_gates/channel_permission_gate';
import TeamPermissionGate from 'components/permissions_gates/team_permission_gate';
import ToggleModalButton from 'components/toggle_modal_button';
import LoadingSpinner from 'components/widgets/loading/loading_spinner';

import {Constants, ModalIdentifiers} from 'utils/constants';

import './add_members_button.scss';

export interface AddMembersButtonProps {
    totalUsers?: number;
    usersLimit: number;
    channel: Channel;
    pluginButtons?: React.ReactNode;
}

const AddMembersButton: React.FC<AddMembersButtonProps> = ({totalUsers, usersLimit, channel, pluginButtons}: AddMembersButtonProps) => {
    const currentTeamId = useSelector(getCurrentTeamId);

    if (!totalUsers) {
        return (<LoadingSpinner/>);
    }

    const inviteUsers = totalUsers < usersLimit;

    return (
        <TeamPermissionGate
            teamId={currentTeamId}
            permissions={[Permissions.ADD_USER_TO_TEAM, Permissions.INVITE_GUEST]}
        >
            {inviteUsers ? (
                <LessThanMaxFreeUsers
                    pluginButtons={pluginButtons}
                />
            ) : (
                <MoreThanMaxFreeUsers
                    channel={channel}
                    pluginButtons={pluginButtons}
                />
            )}
        </TeamPermissionGate>
    );
};

const LessThanMaxFreeUsers = ({pluginButtons}: {pluginButtons: React.ReactNode}) => {
    const {formatMessage} = useIntl();

    return (
        <>
            {pluginButtons}
            <div className='LessThanMaxFreeUsers'>
                <ToggleModalButton
                    id='introTextInvite'
                    emphasis='primary'
                    size='small'
                    modalId={ModalIdentifiers.INVITATION}
                    dialogType={InvitationModal}
                    dialogProps={{focusOriginElement: 'browseOrAddChannelMenuButton'}}
                >
                    <i
                        className='icon-email-plus-outline'
                        title={formatMessage({id: 'generic_icons.add', defaultMessage: 'Add Icon'})}
                        aria-hidden='true'
                    />
                    <FormattedMessage
                        id='intro_messages.inviteOthersToWorkspace.button'
                        defaultMessage='Invite others to the workspace'
                    />
                </ToggleModalButton>
            </div>
        </>
    );
};

const MoreThanMaxFreeUsers = ({channel, pluginButtons}: {channel: Channel; pluginButtons: React.ReactNode}) => {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();

    const channelIsArchived = channel.delete_at !== 0;
    const isPrivate = channel.type === Constants.PRIVATE_CHANNEL;

    const handleAddPeople = useCallback(() => {
        if (channel.group_constrained) {
            dispatch(openModal({
                modalId: ModalIdentifiers.ADD_GROUPS_TO_CHANNEL,
                dialogType: AddGroupsToChannelModal,
                dialogProps: {channel},
            }));
            return;
        }

        dispatch(openModal({
            modalId: ModalIdentifiers.CHANNEL_INVITE,
            dialogType: ChannelInviteModal,
            dialogProps: {channel},
        }));
    }, [channel, dispatch]);

    if (channelIsArchived) {
        return null;
    }

    const addLabel = channel.group_constrained ? formatMessage({id: 'intro_messages.inviteGroupsToChannel.button', defaultMessage: 'Add groups'}) : formatMessage({id: 'intro_messages.inviteMembersToChannel.button', defaultMessage: 'Add people'});

    return (
        <div className='MoreThanMaxFreeUsersWrapper'>
            <div className='MoreThanMaxFreeUsers'>
                <ChannelPermissionGate
                    channelId={channel.id}
                    teamId={channel.team_id}
                    permissions={[isPrivate ? Permissions.MANAGE_PRIVATE_CHANNEL_MEMBERS : Permissions.MANAGE_PUBLIC_CHANNEL_MEMBERS]}
                >
                    <TileButton
                        onClick={handleAddPeople}
                        aria-label={addLabel}
                        aria-haspopup='dialog'
                        icon={<Icon glyph={<AccountPlusOutlineIcon/>}/>}
                        label={addLabel}
                    />
                </ChannelPermissionGate>
            </div>
            {pluginButtons}
        </div>
    );
};

export default React.memo(AddMembersButton);
