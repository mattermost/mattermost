// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';
import {useDispatch} from 'react-redux';

import {BellOffOutlineIcon} from '@mattermost/compass-icons/components';
import type {Channel} from '@mattermost/types/channels';

import {updateChannelNotifyProps} from 'mattermost-redux/actions/channels';

import * as Menu from 'components/menu';

import {Constants, NotificationLevels} from 'utils/constants';

type Props = {
    userID: string;
    channel: Channel;
    isMuted: boolean;
};

export default function ToggleMuteChannel({
    isMuted,
    channel,
    userID,
}: Props) {
    const dispatch = useDispatch();

    const handleClick = () => {
        dispatch(updateChannelNotifyProps(
            userID,
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
                    defaultMessage='Unmute'
                />
            );
        } else {
            text = (
                <FormattedMessage
                    id='channel_header.muteConversation'
                    defaultMessage='Mute'
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
            leadingElement={<BellOffOutlineIcon size='18px'/>}
            id='channelToggleMuteChannel'
            onClick={handleClick}
            labels={text}
        />
    );
}
