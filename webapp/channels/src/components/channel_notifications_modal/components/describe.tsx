// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import {ChannelAutoFollowThreads, IgnoreChannelMentions, NotificationLevels, NotificationSections} from 'utils/constants';
import {t} from 'utils/i18n';

type Props = {
    globalNotifyLevel?: string;
    ignoreChannelMentions?: string;
    channelAutoFollowThreads?: string;
    memberNotifyLevel: string;
    section: string;
    isCollapsed?: boolean;
}

export default function Describe({section, isCollapsed, memberNotifyLevel, globalNotifyLevel, ignoreChannelMentions, channelAutoFollowThreads}: Props) {
    if (memberNotifyLevel === NotificationLevels.DEFAULT && globalNotifyLevel) {
        t('channel_notifications.levels.default');
        t('channel_notifications.levels.all');
        t('channel_notifications.levels.mention');
        t('channel_notifications.levels.none');
        const levelsFormattedMessageId = 'channel_notifications.levels.' + globalNotifyLevel;
        const notifyLevel = (
            <FormattedMessage
                id={levelsFormattedMessageId}
                defaultMessage={globalNotifyLevel}
            />
        );
        return (
            <FormattedMessage
                id='channel_notifications.globalDefault'
                defaultMessage='Global default ({notifyLevel})'
                values={{notifyLevel}}
            />
        );
    } else if (memberNotifyLevel === NotificationLevels.MENTION && section === NotificationSections.MARK_UNREAD) {
        if (isCollapsed) {
            return (
                <FormattedMessage
                    id='channel_notifications.muteChannel.on.title.collapse'
                    defaultMessage='Mute is enabled. Desktop, email and push notifications will not be sent for this channel.'
                />
            );
        }
        return (
            <FormattedMessage
                id='channel_notifications.muteChannel.on.title'
                defaultMessage='On'
            />
        );
    } else if (
        section === NotificationSections.IGNORE_CHANNEL_MENTIONS &&
        ignoreChannelMentions === IgnoreChannelMentions.ON
    ) {
        return (
            <FormattedMessage
                id='channel_notifications.ignoreChannelMentions.on.title'
                defaultMessage='On'
            />
        );
    } else if (
        section === NotificationSections.IGNORE_CHANNEL_MENTIONS &&
        ignoreChannelMentions === IgnoreChannelMentions.OFF
    ) {
        return (
            <FormattedMessage
                id='channel_notifications.ignoreChannelMentions.off.title'
                defaultMessage='Off'
            />
        );
    } else if (
        section === NotificationSections.CHANNEL_AUTO_FOLLOW_THREADS &&
        channelAutoFollowThreads === ChannelAutoFollowThreads.ON
    ) {
        return (
            <FormattedMessage
                id='channel_notifications.channelAutoFollowThreads.on.title'
                defaultMessage='On'
            />
        );
    } else if (
        section === NotificationSections.CHANNEL_AUTO_FOLLOW_THREADS &&
        channelAutoFollowThreads === ChannelAutoFollowThreads.OFF
    ) {
        return (
            <FormattedMessage
                id='channel_notifications.channelAutoFollowThreads.off.title'
                defaultMessage='Off'
            />
        );
    } else if (memberNotifyLevel === NotificationLevels.MENTION) {
        return (
            <FormattedMessage
                id='channel_notifications.onlyMentions'
                defaultMessage='Only for mentions'
            />
        );
    } else if (
        (section === NotificationSections.DESKTOP || section === NotificationSections.PUSH) &&
        memberNotifyLevel === NotificationLevels.ALL
    ) {
        return (
            <FormattedMessage
                id='channel_notifications.allActivity'
                defaultMessage='For all activity'
            />
        );
    } else if (
        section === NotificationSections.MARK_UNREAD &&
        memberNotifyLevel === NotificationLevels.ALL
    ) {
        return (
            <FormattedMessage
                id='channel_notifications.muteChannel.off.title'
                defaultMessage='Off'
            />
        );
    }

    return (
        <FormattedMessage
            id='channel_notifications.never'
            defaultMessage='Never'
        />
    );
}
