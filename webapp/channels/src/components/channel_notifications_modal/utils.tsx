// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {FormattedMessage} from 'react-intl';

import React from 'react';

import {t} from 'utils/i18n';
import {FieldsetCheckbox} from './checkbox-item-creator';

import {FieldsetRadio} from './radio-item-creator';
import {NotificationLevels} from '../../utils/constants';
import {ChannelNotifyProps} from '@mattermost/types/channels';
import {UserNotifyProps} from '@mattermost/types/users';

export type ChannelMemberNotifyProps = Partial<ChannelNotifyProps> & Pick<UserNotifyProps, 'desktop_threads' | 'push_threads'>

export const MuteAndIgnoreSectionTitle = {
    id: t('channel_notifications.muteAndIgnore'),
    defaultMessage: 'Mute or ignore',
};

export const NotifyMeTitle = {
    id: t('channel_notifications.NotifyMeTitle'),
    defaultMessage: 'Notify me about…',
};

export const ThreadsReplyTitle = {
    id: t('channel_notifications.ThreadsReplyTitle'),
    defaultMessage: 'Thread reply notifications',
};

export const DesktopNotificationsSectionTitle = {
    id: t('channel_notifications.desktopNotificationsTitle'),
    defaultMessage: 'Desktop Notifications',
};

export const DesktopNotificationsSectionDesc = {
    id: t('channel_notifications.desktopNotificationsDesc'),
    defaultMessage: 'Available on Chrome, Edge, Firefox, and the Mattermost Desktop App.',
};

export const MobileNotificationsSectionTitle = {
    id: t('channel_notifications.mobileNotificationsTitle'),
    defaultMessage: 'Mobile Notifications',
};

export const MobileNotificationsSectionDesc = {
    id: t('channel_notifications.mobileNotificationsDesc'),
    defaultMessage: 'Notification alerts are pushed to your mobile device when there is activity in Mattermost.',
};

export const MuteChannelDesc = {
    id: t('channel_notifications.muteChannelDesc'),
    defaultMessage: 'Turns off notifications for this channel. You’ll still see badges if you’re mentioned.',
};
export const IgnoreMentionsDesc = {
    id: t('channel_notifications.ignoreMentionsDesc'),
    defaultMessage: 'When enabled, @channel, @here and @all will not trigger mentions or mention notifications in this channel',
};

export const MuteChannelInputFieldData: FieldsetCheckbox = {
    title: {
        id: t('channel_notifications.muteChannelTitle'),
        defaultMessage: 'Mute channel',
    },
    name: 'mute channel',
    dataTestId: 'muteChannel',
};

export const DesktopReplyThreadsInputFieldData: FieldsetCheckbox = {
    title: {
        id: t('channel_notifications.checkbox.threadsReplyTitle'),
        defaultMessage: 'Notify me about replies to threads I’m following',
    },
    name: 'desktop reply threads',
    dataTestId: 'desktopReplyThreads',
};

export const MobileReplyThreadsInputFieldData: FieldsetCheckbox = {
    title: {
        id: t('channel_notifications.checkbox.threadsReplyTitle'),
        defaultMessage: 'Notify me about replies to threads I’m following',
    },
    name: 'mobile reply threads',
    dataTestId: 'mobileReplyThreads',
};

export const sameMobileSettingsDesktopInputFieldData: FieldsetCheckbox = {
    title: {
        id: t('channel_notifications.checkbox.sameMobileSettingsDesktop'),
        defaultMessage: 'Use the same notification settings as desktop',
    },
    name: 'same mobile settings as Desktop',
    dataTestId: 'sameMobileSettingsDesktop',
};

export const IgnoreMentionsInputFieldData: FieldsetCheckbox = {
    title: {
        id: t('channel_notifications.ignoreMentionsTitle'),
        defaultMessage: 'Ignore mentions for @channel, @here and @all',
    },
    name: 'ignore mentions',
    dataTestId: 'ignoreMentions',
};

export const AutoFollowThreadsTitle = {
    id: t('channel_notifications.autoFollowThreadsTitle'),
    defaultMessage: 'Follow all threads in this channel',
};

export const AutoFollowThreadsDesc = {
    id: t('channel_notifications.autoFollowThreadsDesc'),
    defaultMessage: 'When enabled, all new replies in this channel will be automatically followed and will appear in your Threads view.',
};

export const AutoFollowThreadsInputFieldData: FieldsetCheckbox = {
    title: {
        id: t('channel_notifications.checkbox.autoFollowThreadsTitle'),
        defaultMessage: 'Automatically follow threads in this channel',
    },
    name: 'auto follow threads',
    dataTestId: 'autoFollowThreads',
};

export const desktopNotificationInputFieldData = (defaultOption: string): FieldsetRadio => {
    return {
        options: [
            {
                dataTestId: `desktopNotification-${NotificationLevels.ALL}`,
                title: {
                    id: 'channel_notifications.desktopNotificationAllLabel',
                    defaultMessage: 'All new messages',
                },
                name: `desktopNotification-${NotificationLevels.ALL}`,
                key: `desktopNotification-${NotificationLevels.ALL}`,
                value: NotificationLevels.ALL,
                suffix: defaultOption === NotificationLevels.ALL ? (
                    <FormattedMessage
                        id='channel_notifications.default'
                        defaultMessage='(default)'
                    />) : undefined,
            },
            {
                dataTestId: `desktopNotification-${NotificationLevels.MENTION}`,
                title: {
                    id: 'channel_notifications.desktopNotificationMentionLabel',
                    defaultMessage: 'Mentions, direct messages, and keywords only',
                },
                name: `desktopNotification-${NotificationLevels.MENTION}`,
                key: `desktopNotification-${NotificationLevels.MENTION}`,
                value: NotificationLevels.MENTION,
                suffix: defaultOption === NotificationLevels.MENTION ? (
                    <FormattedMessage
                        id='channel_notifications.default'
                        defaultMessage='(default)'
                    />) : undefined,
            },
            {
                dataTestId: `desktopNotification-${NotificationLevels.NONE}`,
                title: {
                    id: 'channel_notifications.desktopNotificationNothingLabel',
                    defaultMessage: 'Nothing',
                },
                name: `desktopNotification-${NotificationLevels.NONE}`,
                key: `desktopNotification-${NotificationLevels.NONE}`,
                value: NotificationLevels.NONE,
                suffix: defaultOption === NotificationLevels.NONE ? (
                    <FormattedMessage
                        id='channel_notifications.default'
                        defaultMessage='(default)'
                    />) : undefined,
            },
        ],
    };
};

export const mobileNotificationInputFieldData = (defaultOption: string): FieldsetRadio => {
    return {
        options: [
            {
                dataTestId: `MobileNotification-${NotificationLevels.ALL}`,
                title: {
                    id: 'channel_notifications.MobileNotificationAllLabel',
                    defaultMessage: 'All new messages',
                },
                name: `MobileNotification-${NotificationLevels.ALL}`,
                key: `MobileNotification-${NotificationLevels.ALL}`,
                value: NotificationLevels.ALL,
                suffix: defaultOption === NotificationLevels.ALL ? (
                    <FormattedMessage
                        id='channel_notifications.default'
                        defaultMessage='(default)'
                    />) : undefined,
            },
            {
                dataTestId: `MobileNotification-${NotificationLevels.MENTION}`,
                title: {
                    id: 'channel_notifications.MobileNotificationMentionLabel',
                    defaultMessage: 'Mentions, direct messages, and keywords only',
                },
                name: `MobileNotification-${NotificationLevels.MENTION}`,
                key: `MobileNotification-${NotificationLevels.MENTION}`,
                value: NotificationLevels.MENTION,
                suffix: defaultOption === NotificationLevels.MENTION ? (
                    <FormattedMessage
                        id='channel_notifications.default'
                        defaultMessage='(default)'
                    />) : undefined,
            },
            {
                dataTestId: `MobileNotification-${NotificationLevels.NONE}`,
                title: {
                    id: 'channel_notifications.MobileNotificationNothingLabel',
                    defaultMessage: 'Nothing',
                },
                name: `MobileNotification-${NotificationLevels.NONE}`,
                key: `MobileNotification-${NotificationLevels.NONE}`,
                value: NotificationLevels.NONE,
                suffix: defaultOption === NotificationLevels.NONE ? (
                    <FormattedMessage
                        id='channel_notifications.default'
                        defaultMessage='(default)'
                    />) : undefined,
            },
        ],
    };
};

