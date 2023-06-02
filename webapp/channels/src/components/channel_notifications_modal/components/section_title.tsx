// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import {NotificationSections} from 'utils/constants';

type Props = {
    section: string;
}

export default function SectionTitle({section}: Props) {
    if (section === NotificationSections.DESKTOP) {
        return (
            <FormattedMessage
                id='channel_notifications.sendDesktop'
                defaultMessage='Send desktop notifications'
            />
        );
    } else if (section === NotificationSections.PUSH) {
        return (
            <FormattedMessage
                id='channel_notifications.push'
                defaultMessage='Send mobile push notifications'
            />
        );
    } else if (section === NotificationSections.MARK_UNREAD) {
        return (
            <FormattedMessage
                id='channel_notifications.muteChannel.settings'
                defaultMessage='Mute Channel'
            />
        );
    } else if (section === NotificationSections.IGNORE_CHANNEL_MENTIONS) {
        return (
            <FormattedMessage
                id='channel_notifications.ignoreChannelMentions'
                defaultMessage='Ignore mentions for @channel, @here and @all'
            />
        );
    } else if (section === NotificationSections.CHANNEL_AUTO_FOLLOW_THREADS) {
        return (
            <FormattedMessage
                id='channel_notifications.channelAutoFollowThreads'
                defaultMessage='Auto-follow all new threads in this channel'
            />
        );
    }

    return null;
}
