// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage, defineMessage} from 'react-intl';
import {useDispatch} from 'react-redux';

import {BellOffOutlineIcon} from '@mattermost/compass-icons/components';
import type {Channel} from '@mattermost/types/channels';

import {updateChannelNotifyProps} from 'mattermost-redux/actions/channels';

import * as Menu from 'components/menu';

import {useChannelKind} from 'hooks/useChannelKind';
import type {KindMessages} from 'utils/channel_kind';
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
    const channelKind = useChannelKind(channel);

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
    } else {
        text = <FormattedMessage {...(isMuted ? messages.unmute : messages.mute)[channelKind]}/>;
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

const messages = {
    mute: {
        channel: defineMessage({
            id: 'channel_header.mute',
            defaultMessage: 'Mute Channel',
        }),
        board: defineMessage({
            id: 'channel_header.mute.board',
            defaultMessage: 'Mute Board',
        }),
    },
    unmute: {
        channel: defineMessage({
            id: 'channel_header.unmute',
            defaultMessage: 'Unmute Channel',
        }),
        board: defineMessage({
            id: 'channel_header.unmute.board',
            defaultMessage: 'Unmute Board',
        }),
    },
} satisfies Record<string, KindMessages>;
