// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Channel, ChannelNotifyProps} from '@mattermost/types/channels';
import type {UserProfile} from '@mattermost/types/users';

import type {ActionFunc} from 'mattermost-redux/types/actions';

import Menu from 'components/widgets/menu/menu';

import {Constants, NotificationLevels} from 'utils/constants';
import {localizeMessage} from 'utils/utils';

export type Actions = {
    updateChannelNotifyProps(userId: string, channelId: string, props: Partial<ChannelNotifyProps>): ActionFunc;
};

type Props = {

    /**
     * Object with info about the current user
     */
    user: UserProfile;

    /**
     * Object with info about the current channel
     */
    channel: Channel;

    /**
     * Boolean whether the current channel is muted
     */
    isMuted: boolean;

    /**
     * Use for test selector
     */
    id?: string;

    /**
     * Object with action creators
     */
    actions: Actions;
};

export default class MenuItemToggleMuteChannel extends React.PureComponent<Props> {
    handleClick = () => {
        const {
            user,
            channel,
            isMuted,
            actions: {
                updateChannelNotifyProps,
            },
        } = this.props;

        updateChannelNotifyProps(user.id, channel.id, {
            mark_unread: (isMuted ? NotificationLevels.ALL : NotificationLevels.MENTION) as 'all' | 'mention',
        });
    };

    render() {
        const {
            id,
            isMuted,
            channel,
        } = this.props;

        let text;
        if (channel.type === Constants.DM_CHANNEL || channel.type === Constants.GM_CHANNEL) {
            text = isMuted ? localizeMessage('channel_header.unmuteConversation', 'Unmute Conversation') : localizeMessage('channel_header.muteConversation', 'Mute Conversation');
        } else {
            text = isMuted ? localizeMessage('channel_header.unmute', 'Unmute Channel') : localizeMessage('channel_header.mute', 'Mute Channel');
        }

        return (
            <Menu.ItemAction
                id={id}
                onClick={this.handleClick}
                text={text}
            />
        );
    }
}
