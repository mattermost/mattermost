// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ReactNode} from 'react';
import React from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import {
    ChevronRightIcon,
    CogOutlineIcon,
} from '@mattermost/compass-icons/components';
import type {Channel} from '@mattermost/types/channels';
import type {UserProfile} from '@mattermost/types/users';

import {Permissions} from 'mattermost-redux/constants';
import {isGuest} from 'mattermost-redux/utils/user_utils';

import ChannelMoveToSubMenu from 'components/channel_move_to_sub_menu';
import * as Menu from 'components/menu';
import ChannelPermissionGate from 'components/permissions_gates/channel_permission_gate';

import MenuItemChannelBookmarks from '../menu_items/channel_bookmarks_submenu';
import CloseMessage from '../menu_items/close_message';
import MenuItemConvertToPrivate from '../menu_items/convert_gm_to_private';
import EditConversationHeader from '../menu_items/edit_conversation_header';
import MenuItemNotification from '../menu_items/notification';
import MenuItemOpenMembersRHS from '../menu_items/open_members_rhs';
import MenuItemPluginItems from '../menu_items/plugins_submenu';
import MenuItemToggleFavoriteChannel from '../menu_items/toggle_favorite_channel';
import MenuItemToggleInfo from '../menu_items/toggle_info';
import MenuItemToggleMuteChannel from '../menu_items/toggle_mute_channel';
import MenuItemViewPinnedPosts from '../menu_items/view_pinned_posts';

interface Props extends Menu.FirstMenuItemProps {
    channel: Channel;
    user: UserProfile;
    isMuted: boolean;
    isMobile: boolean;
    isFavorite: boolean;
    pluginItems: ReactNode[];
    isChannelBookmarksEnabled: boolean;
}

const ChannelHeaderGroupMenu = ({channel, user, isMuted, isMobile, isFavorite, pluginItems, isChannelBookmarksEnabled, ...rest}: Props) => {
    const isGroupConstrained = channel?.group_constrained === true;
    const isArchived = channel.delete_at !== 0;
    const {formatMessage} = useIntl();

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
            {(!isArchived && isGuest(user.roles)) && (
                <EditConversationHeader
                    leadingElement={<CogOutlineIcon size='18px'/>}
                    channel={channel}
                />
            )}
            {(!isArchived && !isGroupConstrained && !isGuest(user.roles)) && (
                <Menu.SubMenu
                    id={'channelSettings'}
                    labels={
                        <FormattedMessage
                            id='channel_header.settings'
                            defaultMessage='Settings'
                        />
                    }
                    leadingElement={<CogOutlineIcon size={18}/>}
                    trailingElements={<ChevronRightIcon size={16}/>}
                    menuId={'channelSettings-menu'}
                    menuAriaLabel={formatMessage({id: 'channel_header.settings', defaultMessage: 'Settings'})}
                >
                    <EditConversationHeader
                        channel={channel}
                    />
                    <MenuItemConvertToPrivate
                        channel={channel}
                    />
                </Menu.SubMenu>
            )}
            {!isArchived && !isGuest(user.roles) && isChannelBookmarksEnabled && (
                <MenuItemChannelBookmarks
                    channel={channel}
                />
            )}
            <Menu.Separator/>
            {(!isArchived && !isGroupConstrained) && (
                <ChannelPermissionGate
                    channelId={channel.id}
                    teamId={channel.team_id}
                    permissions={[Permissions.MANAGE_PUBLIC_CHANNEL_MEMBERS]}
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
                    <Menu.Separator/>
                </ChannelPermissionGate>
            )}
            <ChannelMoveToSubMenu channel={channel}/>
            {!isMobile && (
                <MenuItemPluginItems pluginItems={pluginItems}/>
            )}
            <Menu.Separator/>
            <CloseMessage
                currentUserID={user.id}
                channel={channel}
            />
        </>
    );
};

export default ChannelHeaderGroupMenu;
