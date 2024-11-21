// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ReactNode} from 'react';
import React from 'react';
import {FormattedMessage} from 'react-intl';

import type {Channel} from '@mattermost/types/channels';
import type {UserProfile} from '@mattermost/types/users';

import {Permissions} from 'mattermost-redux/constants';
import {isGuest} from 'mattermost-redux/utils/user_utils';

import ChannelMoveToSubMenu from 'components/channel_move_to_sub_menu';
import * as Menu from 'components/menu';
import ChannelPermissionGate from 'components/permissions_gates/channel_permission_gate';

// import MenuItemAddGroupMembers from '../menu_items/add_members_group/add_member_group';
// import CloseMessage from '../menu_items/close_message/close_message';
// import MenuItemConvertToPrivate from '../menu_items/convert_gm_to_private/convert_gm_to_private';
// import EditConversationHeader from '../menu_items/edit_conversation_header/edit_conversation_header';
// import MenuItemNotification from '../menu_items/notification/notification';
// import MenuItemToggleMuteChannel from '../menu_items/toggle_mute_channel/toggle_mute_channel';

import MenutItemAddMembers from '../menu_items/add_channel_members/add_channel_members';
import MenuItemArchiveChannel from '../menu_items/archive_channel/archive_channel';
import MenuItemCloseChannel from '../menu_items/close_channel/close_channel';
import MenuItemConvertToPrivate from '../menu_items/convert_public_to_private/convert_public_to_private';
import MenuItemEditChannelData from '../menu_items/edit_channel_data/edit_channel_data';
import MenuItemGroupsMenuItems from '../menu_items/groups/groups';
import MenuItemLeaveChannel from '../menu_items/leave_channel/leave_channel';
import MenuItemNotification from '../menu_items/notification/notification';
import MenuItemOpenMembersRHS from '../menu_items/open_members_rhs/open_members_rhs';
// import MenuItemToggleFavoriteChannel from '../menu_items/toggle_favorite_channel/toggle_favorite_channel';
import MenuItemToggleInfo from '../menu_items/toggle_info/toggle_info';
import MenuItemToggleMuteChannel from '../menu_items/toggle_mute_channel/toggle_mute_channel';
import MenuItemUnarchiveChannel from '../menu_items/unarchive_channel/unarchive_channel';

type Props = {
    channel: Channel;
    user: UserProfile;
    isMuted: boolean;
    isArchived: boolean;
    isGroupConstrained: boolean;
    isReadonly: boolean;
    isDefault: boolean;
    isPrivate: boolean;
    isLicensedForLDAPGroups: boolean;
    pluginItems: ReactNode;
};

const ChannelHeaderPublicMenu = ({channel, user, isMuted, isArchived, isGroupConstrained, isReadonly, isDefault, isPrivate, isLicensedForLDAPGroups, pluginItems}: Props) => {
    const channelMembersPermission = isPrivate ? Permissions.MANAGE_PRIVATE_CHANNEL_MEMBERS : Permissions.MANAGE_PUBLIC_CHANNEL_MEMBERS;
    const channelPropertiesPermission = isPrivate ? Permissions.MANAGE_PRIVATE_CHANNEL_PROPERTIES : Permissions.MANAGE_PUBLIC_CHANNEL_PROPERTIES;
    const channelDeletePermission = isPrivate ? Permissions.DELETE_PRIVATE_CHANNEL : Permissions.DELETE_PUBLIC_CHANNEL;
    const channelUnarchivePermission = Permissions.MANAGE_TEAM;

    return (
        <>
            <MenuItemToggleInfo
                channel={channel}
            />
            <ChannelMoveToSubMenu channel={channel}/>
            <Menu.Separator/>
            <MenuItemNotification
                user={user}
                channel={channel}
                isArchived={isArchived}
            />
            <MenuItemToggleMuteChannel
                id='channelToggleMuteChannel'
                user={user}
                channel={channel}
                isMuted={isMuted}
            />
            <Menu.Separator/>

            <ChannelPermissionGate
                channelId={channel.id}
                teamId={channel.team_id}
                permissions={[channelMembersPermission]}
            >
                <MenutItemAddMembers
                    channel={channel}
                    isArchived={isArchived}
                    isGroupConstrained={isGroupConstrained}
                    isDefault={isDefault}
                />
            </ChannelPermissionGate>

            {(isArchived || isDefault) && (
                <MenuItemOpenMembersRHS
                    id='channelViewMembers'
                    channel={channel}
                    text={
                        <FormattedMessage
                            id='channel_header.viewMembers'
                            defaultMessage='View Members'
                        />
                    }
                />
            )}

            <ChannelPermissionGate
                channelId={channel.id}
                teamId={channel.team_id}
                permissions={[channelMembersPermission]}
            >
                <MenuItemGroupsMenuItems
                    channel={channel}
                    isArchived={isArchived}
                    isGroupConstrained={isGroupConstrained}
                    isDefault={isDefault}
                    isLicensedForLDAPGroups={isLicensedForLDAPGroups}
                />
                {!isArchived && !isDefault && (
                    <MenuItemOpenMembersRHS
                        id='channelManageMembers'
                        channel={channel}
                        text={
                            <FormattedMessage
                                id='channel_header.manageMembers'
                                defaultMessage='Manage Members'
                            />
                        }
                        editMembers={!isArchived}
                    />
                )}
            </ChannelPermissionGate>

            <ChannelPermissionGate
                channelId={channel.id}
                teamId={channel.team_id}
                permissions={[channelMembersPermission]}
                invert={true}
            >
                {!isArchived && !isDefault && (
                    <MenuItemOpenMembersRHS
                        id='channelViewMembers'
                        channel={channel}
                        text={
                            <FormattedMessage
                                id='channel_header.viewMembers'
                                defaultMessage='View Members'
                            />
                        }
                    />
                )}
            </ChannelPermissionGate>

            <Menu.Separator/>

            <ChannelPermissionGate
                channelId={channel.id}
                teamId={channel.team_id}
                permissions={[channelPropertiesPermission]}
            >
                <MenuItemEditChannelData
                    isArchived={isArchived}
                    isReadonly={isReadonly}
                    channel={channel}
                />
            </ChannelPermissionGate>

            <ChannelPermissionGate
                channelId={channel.id}
                teamId={channel.team_id}
                permissions={[Permissions.CONVERT_PUBLIC_CHANNEL_TO_PRIVATE]}
            >
                <MenuItemConvertToPrivate
                    isArchived={isArchived}
                    isDefault={isDefault}
                    channel={channel}
                />
            </ChannelPermissionGate>

            <MenuItemLeaveChannel
                id='channelLeaveChannel'
                channel={channel}
                isDefault={isDefault}
                isGuestUser={isGuest(user.roles)}
            />

            <ChannelPermissionGate
                channelId={channel.id}
                teamId={channel.team_id}
                permissions={[channelDeletePermission]}
            >
                <MenuItemArchiveChannel
                    channel={channel}
                    isArchived={isArchived}
                    isDefault={isDefault}
                />
            </ChannelPermissionGate>

            <MenuItemCloseChannel
                isArchived={isArchived}
            />

            <Menu.Separator/>
            {pluginItems}

            <ChannelPermissionGate
                channelId={channel.id}
                teamId={channel.team_id}
                permissions={[channelUnarchivePermission]}
            >
                <MenuItemUnarchiveChannel
                    channel={channel}
                    isArchived={isArchived}
                    isDefault={isDefault}
                />
            </ChannelPermissionGate>

        </>
    );
};

export default ChannelHeaderPublicMenu;
