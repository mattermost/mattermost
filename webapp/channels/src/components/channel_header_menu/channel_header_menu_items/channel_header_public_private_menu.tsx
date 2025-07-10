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

import MenuItemArchiveChannel from '../menu_items/archive_channel';
import MenuItemChannelBookmarks from '../menu_items/channel_bookmarks_submenu';
import MenuItemChannelSettings from '../menu_items/channel_settings_menu';
import MenuItemCloseChannel from '../menu_items/close_channel';
import MenuItemGroupsMenuItems from '../menu_items/groups';
import MenuItemLeaveChannel from '../menu_items/leave_channel';
import MenuItemNotification from '../menu_items/notification';
import MenuItemOpenMembersRHS from '../menu_items/open_members_rhs';
import MenuItemPluginItems from '../menu_items/plugins_submenu';
import MenuItemToggleFavoriteChannel from '../menu_items/toggle_favorite_channel';
import MenuItemToggleInfo from '../menu_items/toggle_info';
import MenuItemToggleMuteChannel from '../menu_items/toggle_mute_channel';
import MenuItemUnarchiveChannel from '../menu_items/unarchive_channel';
import MenuItemViewPinnedPosts from '../menu_items/view_pinned_posts';

interface Props extends Menu.FirstMenuItemProps {
    channel: Channel;
    user: UserProfile;
    isMuted: boolean;
    isReadonly: boolean;
    isDefault: boolean;
    isMobile: boolean;
    isFavorite: boolean;
    isLicensedForLDAPGroups: boolean;
    pluginItems: ReactNode[];
    isChannelBookmarksEnabled: boolean;
}

const ChannelHeaderPublicMenu = ({channel, user, isMuted, isDefault, isMobile, isFavorite, isLicensedForLDAPGroups, pluginItems, isChannelBookmarksEnabled, ...rest}: Props) => {
    const isGroupConstrained = channel?.group_constrained === true;
    const isArchived = channel.delete_at !== 0;
    const isPrivate = channel?.type === Constants.PRIVATE_CHANNEL;

    const channelMembersPermission = isPrivate ? Permissions.MANAGE_PRIVATE_CHANNEL_MEMBERS : Permissions.MANAGE_PUBLIC_CHANNEL_MEMBERS;
    const channelDeletePermission = isPrivate ? Permissions.DELETE_PRIVATE_CHANNEL : Permissions.DELETE_PUBLIC_CHANNEL;
    const channelUnarchivePermission = Permissions.MANAGE_TEAM;

    return (
        <>
            <MenuItemToggleInfo
                channel={channel}
                {...rest}
            />
            <MenuItemToggleMuteChannel
                userID={user.id}
                channel={channel}
                isMuted={isMuted}
            />
            {!isArchived && (
                <>
                    <MenuItemNotification
                        user={user}
                        channel={channel}
                    />
                    <MenuItemChannelSettings
                        channel={channel}
                    />
                    {isChannelBookmarksEnabled && (
                        <MenuItemChannelBookmarks
                            channel={channel}
                        />
                    )}
                </>
            )}
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
                    <Menu.Separator/>
                </>
            )}

            {(isArchived || isDefault) && (
                <MenuItemOpenMembersRHS
                    id='channelMembers'
                    channel={channel}
                    text={
                        <FormattedMessage
                            id='channel_header.members'
                            defaultMessage='Members'
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
                        {isGroupConstrained && isLicensedForLDAPGroups && (
                            <MenuItemGroupsMenuItems
                                channel={channel}
                            />
                        )}
                        <MenuItemOpenMembersRHS
                            id='channelMembers'
                            channel={channel}
                            text={
                                <FormattedMessage
                                    id='channel_header.members'
                                    defaultMessage='Members'
                                />
                            }
                        />
                    </ChannelPermissionGate>

                    <ChannelPermissionGate
                        channelId={channel.id}
                        teamId={channel.team_id}
                        permissions={[channelMembersPermission]}
                        invert={true}
                    >
                        <MenuItemOpenMembersRHS
                            id='channelMembers'
                            channel={channel}
                            text={
                                <FormattedMessage
                                    id='channel_header.members'
                                    defaultMessage='Members'
                                />
                            }
                        />
                    </ChannelPermissionGate>
                </>
            )}

            <Menu.Separator/>
            <ChannelMoveToSubMenu channel={channel}/>
            {!isMobile && (
                <MenuItemPluginItems pluginItems={pluginItems}/>
            )}
            {!isDefault && (
                <Menu.Separator/>
            )}
            {!isDefault && !isGuest(user.roles) && (
                <MenuItemLeaveChannel
                    id='channelLeaveChannel'
                    channel={channel}
                />
            )}

            {isArchived && (
                <MenuItemCloseChannel/>
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
