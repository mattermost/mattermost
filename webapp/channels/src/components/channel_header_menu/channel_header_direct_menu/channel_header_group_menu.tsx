// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ReactNode} from 'react';
import React from 'react';

import type {Channel} from '@mattermost/types/channels';
import type {UserProfile} from '@mattermost/types/users';

import {Permissions} from 'mattermost-redux/constants';

import ChannelMoveToSubMenu from 'components/channel_move_to_sub_menu';
import * as Menu from 'components/menu';
import ChannelPermissionGate from 'components/permissions_gates/channel_permission_gate';

import MenuItemAddGroupMembers from '../menu_items/add_group_members/add_group_members';
import CloseMessage from '../menu_items/close_message/close_message';
import MenuItemConvertToPrivate from '../menu_items/convert_gm_to_private/convert_gm_to_private';
import EditConversationHeader from '../menu_items/edit_conversation_header/edit_conversation_header';
import MenuItemNotification from '../menu_items/notification/notification';
import MenuItemToggleMuteChannel from '../menu_items/toggle_mute_channel/toggle_mute_channel';

type Props = {
    channel: Channel;
    user: UserProfile;
    isMuted: boolean;
    isArchived: boolean;
    isGroupConstrained: boolean;
    isReadonly: boolean;
    pluginItems: ReactNode;
};

const ChannelHeaderGroupMenu = ({channel, user, isMuted, isArchived, isGroupConstrained, isReadonly, pluginItems}: Props) => {
    return (
        <>
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
                permissions={[Permissions.MANAGE_PUBLIC_CHANNEL_MEMBERS]}
            >
                <MenuItemAddGroupMembers
                    isArchived={isArchived}
                    isGroupConstrained={isGroupConstrained}
                />
                <Menu.Separator/>
            </ChannelPermissionGate>

            <EditConversationHeader
                channel={channel}
            />
            <MenuItemConvertToPrivate
                user={user}
                channel={channel}
                isArchived={isArchived}
                isReadonly={isReadonly}
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

export default ChannelHeaderGroupMenu;
