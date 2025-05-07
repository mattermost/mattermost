// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ReactNode} from 'react';
import React from 'react';

import {CogOutlineIcon} from '@mattermost/compass-icons/components';
import type {Channel} from '@mattermost/types/channels';
import type {UserProfile} from '@mattermost/types/users';

import {isGuest} from 'mattermost-redux/utils/user_utils';

import ChannelMoveToSubMenu from 'components/channel_move_to_sub_menu';
import * as Menu from 'components/menu';

import MenuItemChannelBookmarks from '../menu_items/channel_bookmarks_submenu';
import CloseMessage from '../menu_items/close_message';
import EditConversationHeader from '../menu_items/edit_conversation_header';
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

const ChannelHeaderDirectMenu = ({channel, user, isMuted, isMobile, isFavorite, pluginItems, isChannelBookmarksEnabled, ...rest}: Props) => {
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
            <EditConversationHeader
                leadingElement={<CogOutlineIcon size='18px'/>}
                channel={channel}
            />
            <Menu.Separator/>
            {!isGuest(user.roles) && isChannelBookmarksEnabled && (
                <MenuItemChannelBookmarks
                    channel={channel}
                />
            )}
            <ChannelMoveToSubMenu
                channel={channel}
            />
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

export default ChannelHeaderDirectMenu;
