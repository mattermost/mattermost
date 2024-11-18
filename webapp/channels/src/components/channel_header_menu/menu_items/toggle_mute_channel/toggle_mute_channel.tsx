// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {FormattedMessage} from 'react-intl';
import {useDispatch} from 'react-redux';

import type {Channel, ChannelNotifyProps} from '@mattermost/types/channels';
import type {UserProfile} from '@mattermost/types/users';

import {updateChannelNotifyProps} from 'mattermost-redux/actions/channels';

import * as Menu from 'components/menu';

import {Constants, NotificationLevels} from 'utils/constants';

type Props = {
    user: UserProfile;
    channel: Channel;
    isMuted: boolean;
    id?: string;
};

export default function MenuItemToggleMuteChannel({
    id,
    isMuted,
    channel,
    user,
}: Props) {
    const dispatch = useDispatch();

    const handleClick = () => {
        dispatch(updateChannelNotifyProps(
            user.id,
            channel.id,
            {
                mark_unread: (isMuted ? NotificationLevels.ALL : NotificationLevels.MENTION) as 'all' | 'mention',
            },
        ));
    };

    let text;
    if (channel.type === Constants.DM_CHANNEL || channel.type === Constants.GM_CHANNEL) {
        if (isMuted) {
            text = (
                <FormattedMessage
                    id='channel_header.unmuteConversation'
                    defaultMessage='Unmute Conversation'
                />
            );
        } else {
            text = (
                <FormattedMessage
                    id='channel_header.muteConversation'
                    defaultMessage='Mute Conversation'
                />
            );
        }
    } else if (isMuted) {
        text = (
            <FormattedMessage
                id='channel_header.unmute'
                defaultMessage='Unmute Channel'
            />
        );
    } else {
        text = (
            <FormattedMessage
                id='channel_header.mute'
                defaultMessage='Mute Channel'
            />
        );
    }

    return (
        <Menu.Item
            id={id}
            onClick={handleClick}
            labels={text}
        />
    );
}
