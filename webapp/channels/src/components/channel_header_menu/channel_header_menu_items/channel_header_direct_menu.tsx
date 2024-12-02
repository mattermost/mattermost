// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ReactNode} from 'react';
import React from 'react';

import type {Channel} from '@mattermost/types/channels';
import type {UserProfile} from '@mattermost/types/users';

import ChannelMoveToSubMenu from 'components/channel_move_to_sub_menu';
import * as Menu from 'components/menu';

import CloseMessage from '../menu_items/close_message/close_message';
import EditConversationHeader from '../menu_items/edit_conversation_header/edit_conversation_header';
import MenuItemToggleFavoriteChannel from '../menu_items/toggle_favorite_channel/toggle_favorite_channel';
import MenuItemToggleMuteChannel from '../menu_items/toggle_mute_channel/toggle_mute_channel';
import MenuItemViewPinnedPosts from '../menu_items/view_pinned_posts/view_pinned_posts';

type Props = {
    channel: Channel;
    user: UserProfile;
    isMuted: boolean;
    isMobile: boolean;
    isFavorite: boolean;
    pluginItems: ReactNode;
};

const ChannelHeaderDirectMenu = ({channel, user, isMuted, isMobile, isFavorite, pluginItems}: Props) => {
    return (
        <>
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

            <MenuItemToggleMuteChannel
                id='channelToggleMuteChannel'
                user={user}
                channel={channel}
                isMuted={isMuted}
            />
            <Menu.Separator/>
            <EditConversationHeader
                channel={channel}
            />
            <Menu.Separator/>
            <CloseMessage
                currentUser={user}
                channel={channel}
            />
            <Menu.Separator/>
            {pluginItems}
        </>
    );
};

export default ChannelHeaderDirectMenu;
