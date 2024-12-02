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

import {Constants} from 'utils/constants';

import MenuItemAddMembers from '../menu_items/add_channel_members/add_channel_members';
import MenuItemArchiveChannel from '../menu_items/archive_channel/archive_channel';
import MenuItemCloseChannel from '../menu_items/close_channel/close_channel';
import MenuItemConvertToPrivate from '../menu_items/convert_public_to_private/convert_public_to_private';
import MenuItemEditChannelData from '../menu_items/edit_channel_data/edit_channel_data';
import MenuItemGroupsMenuItems from '../menu_items/groups/groups';
import MenuItemLeaveChannel from '../menu_items/leave_channel/leave_channel';
import MenuItemNotification from '../menu_items/notification/notification';
import MenuItemOpenMembersRHS from '../menu_items/open_members_rhs/open_members_rhs';
import MenuItemToggleFavoriteChannel from '../menu_items/toggle_favorite_channel/toggle_favorite_channel';
import MenuItemToggleInfo from '../menu_items/toggle_info/toggle_info';
import MenuItemToggleMuteChannel from '../menu_items/toggle_mute_channel/toggle_mute_channel';
import MenuItemUnarchiveChannel from '../menu_items/unarchive_channel/unarchive_channel';
import MenuItemViewPinnedPosts from '../menu_items/view_pinned_posts/view_pinned_posts';

type Props = {
    channel: Channel;
    user: UserProfile;
    isMuted: boolean;
    isReadonly: boolean;
    isDefault: boolean;
    isMobile: boolean;
    isFavorite: boolean;
    isLicensedForLDAPGroups: boolean;
    pluginItems: ReactNode;
};

const ChannelHeaderPublicMenu = ({channel, user, isMuted, isReadonly, isDefault, isMobile, isFavorite, isLicensedForLDAPGroups, pluginItems}: Props) => {
    const isGroupConstrained = channel?.group_constrained === true;
    const isArchived = channel.delete_at !== 0;
    const isPrivate = channel?.type === Constants.PRIVATE_CHANNEL;

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
            {isMobile && (
                <>
                    <MenuItemToggleFavoriteChannel
                        channelID={channel.id}
                        isFavorite={isFavorite}
                    />
                    <MenuItemViewPinnedPosts
                        channelID={channel.id}
                    />
                </>
            )}
            {!isArchived && (
                <MenuItemNotification
                    user={user}
                    channel={channel}
                />
            )}

            <MenuItemToggleMuteChannel
                id='channelToggleMuteChannel'
                user={user}
                channel={channel}
                isMuted={isMuted}
            />
            <Menu.Separator/>

            {(!isArchived && !isGroupConstrained && !isDefault) && (
                <ChannelPermissionGate
                    channelId={channel.id}
                    teamId={channel.team_id}
                    permissions={[channelMembersPermission]}
                >
                    <MenuItemAddMembers
                        channel={channel}
                    />
                </ChannelPermissionGate>
            )}

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

            {!isArchived && !isDefault && (
                <>
                    <ChannelPermissionGate
                        channelId={channel.id}
                        teamId={channel.team_id}
                        permissions={[channelMembersPermission]}
                    >

                        {!isGroupConstrained && !isLicensedForLDAPGroups && (
                            <MenuItemGroupsMenuItems
                                channel={channel}
                            />
                        )}
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
                    </ChannelPermissionGate>

                    <ChannelPermissionGate
                        channelId={channel.id}
                        teamId={channel.team_id}
                        permissions={[channelMembersPermission]}
                        invert={true}
                    >
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
                    </ChannelPermissionGate>
                </>
            )}

            <Menu.Separator/>

            {!isArchived && (
                <ChannelPermissionGate
                    channelId={channel.id}
                    teamId={channel.team_id}
                    permissions={[channelPropertiesPermission]}
                >
                    <MenuItemEditChannelData
                        isReadonly={isReadonly}
                        channel={channel}
                    />
                </ChannelPermissionGate>
            )}

            {!isArchived && !isDefault && channel.type === Constants.OPEN_CHANNEL && (
                <ChannelPermissionGate
                    channelId={channel.id}
                    teamId={channel.team_id}
                    permissions={[Permissions.CONVERT_PUBLIC_CHANNEL_TO_PRIVATE]}
                >
                    <MenuItemConvertToPrivate
                        channel={channel}
                    />
                </ChannelPermissionGate>
            )}

            {!isDefault && !isGuest(user.roles) && (
                <MenuItemLeaveChannel
                    id='channelLeaveChannel'
                    channel={channel}
                />
            )}

            {!isArchived && !isDefault && (
                <ChannelPermissionGate
                    channelId={channel.id}
                    teamId={channel.team_id}
                    permissions={[channelDeletePermission]}
                >
                    <MenuItemArchiveChannel
                        channel={channel}
                    />
                </ChannelPermissionGate>
            )}

            {isArchived && (
                <MenuItemCloseChannel/>
            )}

            <Menu.Separator/>
            {pluginItems}

            {isArchived && !isDefault && (
                <ChannelPermissionGate
                    channelId={channel.id}
                    teamId={channel.team_id}
                    permissions={[channelUnarchivePermission]}
                >
                    <MenuItemUnarchiveChannel
                        channel={channel}
                    />
                </ChannelPermissionGate>
            )}
        </>
    );
};

export default ChannelHeaderPublicMenu;
