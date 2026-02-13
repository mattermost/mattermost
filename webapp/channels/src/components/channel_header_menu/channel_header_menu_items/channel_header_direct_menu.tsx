// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ReactNode} from 'react';
import React from 'react';
import {useSelector} from 'react-redux';

import {CogOutlineIcon} from '@mattermost/compass-icons/components';
import type {Channel} from '@mattermost/types/channels';
import type {UserProfile} from '@mattermost/types/users';

import {isGuest} from 'mattermost-redux/utils/user_utils';

import {canAccessChannelSettings} from 'selectors/views/channel_settings';

import ChannelMoveToSubMenu from 'components/channel_move_to_sub_menu';
import * as Menu from 'components/menu';

import type {GlobalState} from 'types/store';

import MenuItemAutotranslation from '../menu_items/autotranslation';
import MenuItemChannelBookmarks from '../menu_items/channel_bookmarks_submenu';
import MenuItemChannelSettings from '../menu_items/channel_settings_menu';
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
    isChannelAutotranslated: boolean;
}

const ChannelHeaderDirectMenu = ({channel, user, isMuted, isMobile, isFavorite, pluginItems, isChannelBookmarksEnabled, isChannelAutotranslated, ...rest}: Props) => {
    const canAccessChannelSettingsForChannel = useSelector((state: GlobalState) => canAccessChannelSettings(state, channel.id));

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
            {canAccessChannelSettingsForChannel ? (
                <MenuItemChannelSettings
                    channel={channel}
                />
            ) : (
                <EditConversationHeader
                    leadingElement={<CogOutlineIcon size='18px'/>}
                    channel={channel}
                />
            )}
            {isChannelAutotranslated && (
                <MenuItemAutotranslation
                    channel={channel}
                />
            )}
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
