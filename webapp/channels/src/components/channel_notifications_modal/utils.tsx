// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage, defineMessages} from 'react-intl';

import type {ChannelNotifyProps} from '@mattermost/types/channels';
import type {UserNotifyProps} from '@mattermost/types/users';

import type {FieldsetCheckbox} from 'components/widgets/modals/components/checkbox_setting_item';
import type {FieldsetRadio} from 'components/widgets/modals/components/radio_setting_item';

import {NotificationLevels} from 'utils/constants';

export type ChannelMemberNotifyProps = Partial<ChannelNotifyProps> & Pick<UserNotifyProps, 'desktop_threads' | 'push_threads'>

const translations = defineMessages({
    MuteAndIgnoreSectionTitle: {
        id: 'channel_notifications.muteAndIgnore',
        defaultMessage: 'Mute or ignore',
    },
    NotifyMeTitle: {
        id: 'channel_notifications.NotifyMeTitle',
        defaultMessage: 'Notify me about…',
    },
    ThreadsReplyTitle: {
        id: 'channel_notifications.ThreadsReplyTitle',
        defaultMessage: 'Thread reply notifications',
    },

    DesktopNotificationsSectionTitle: {
        id: 'channel_notifications.desktopNotificationsTitle',
        defaultMessage: 'Desktop Notifications',
    },

    DesktopNotificationsSectionDesc: {
        id: 'channel_notifications.desktopNotificationsDesc',
        defaultMessage: 'Available on Chrome, Edge, Firefox, and the Mattermost Desktop App.',
    },

    MobileNotificationsSectionTitle: {
        id: 'channel_notifications.mobileNotificationsTitle',
        defaultMessage: 'Mobile Notifications',
    },

    MobileNotificationsSectionDesc: {
        id: 'channel_notifications.mobileNotificationsDesc',
        defaultMessage: 'Notification alerts are pushed to your mobile device when there is activity in Mattermost.',
    },

    MuteChannelDesc: {
        id: 'channel_notifications.muteChannelDesc',
        defaultMessage: 'Turns off notifications for this channel. You’ll still see badges if you’re mentioned.',
    },

    IgnoreMentionsDesc: {
        id: 'channel_notifications.ignoreMentionsDesc',
        defaultMessage: 'When enabled, @channel, @here and @all will not trigger mentions or mention notifications in this channel',
    },

    MuteChannelInputFieldTitle: {
        id: 'channel_notifications.muteChannelTitle',
        defaultMessage: 'Mute channel',
    },

    DesktopReplyThreadsInputFieldTitle: {
        id: 'channel_notifications.checkbox.threadsReplyTitle',
        defaultMessage: 'Notify me about replies to threads I\'m following',
    },

    MobileReplyThreadsInputFieldTitle: {
        id: 'channel_notifications.checkbox.threadsReplyTitle',
        defaultMessage: 'Notify me about replies to threads I\'m following',
    },

    sameMobileSettingsDesktopInputFieldTitle: {
        id: 'channel_notifications.checkbox.sameMobileSettingsDesktop',
        defaultMessage: 'Use the same notification settings as desktop',
    },

    IgnoreMentionsInputFieldTitle: {
        id: 'channel_notifications.ignoreMentionsTitle',
        defaultMessage: 'Ignore mentions for @channel, @here and @all',
    },

    AutoFollowThreadsTitle: {
        id: 'channel_notifications.autoFollowThreadsTitle',
        defaultMessage: 'Follow all threads in this channel',
    },

    AutoFollowThreadsDesc: {
        id: 'channel_notifications.autoFollowThreadsDesc',
        defaultMessage: 'When enabled, all new replies in this channel will be automatically followed and will appear in your Threads view.',
    },

    AutoFollowThreadsInputFieldTitle: {
        id: 'channel_notifications.checkbox.autoFollowThreadsTitle',
        defaultMessage: 'Automatically follow threads in this channel',
    },
});

const desktopNotificationInputFieldOptions = defineMessages({
    allNewMessages: {
        id: 'channel_notifications.desktopNotificationAllLabel',
        defaultMessage: 'All new messages',
    },
    mentions: {
        id: 'channel_notifications.desktopNotificationMentionLabel',
        defaultMessage: 'Mentions, direct messages, and keywords only',
    },
    nothing: {
        id: 'channel_notifications.desktopNotificationNothingLabel',
        defaultMessage: 'Nothing',
    },
});

const mobileNotificationInputFieldOptions = defineMessages({
    allNewMessages: {
        id: 'channel_notifications.MobileNotificationAllLabel',
        defaultMessage: 'All new messages',
    },
    mentions: {
        id: 'channel_notifications.MobileNotificationMentionLabel',
        defaultMessage: 'Mentions, direct messages, and keywords only',
    },
    nothing: {
        id: 'channel_notifications.MobileNotificationNothingLabel',
        defaultMessage: 'Nothing',
    },
});

const MuteChannelInputFieldData: FieldsetCheckbox = {
    title: translations.MuteChannelInputFieldTitle,
    name: 'mute channel',
    dataTestId: 'muteChannel',
};

const DesktopReplyThreadsInputFieldData: FieldsetCheckbox = {
    title: translations.DesktopReplyThreadsInputFieldTitle,
    name: 'desktop reply threads',
    dataTestId: 'desktopReplyThreads',
};

const MobileReplyThreadsInputFieldData: FieldsetCheckbox = {
    title: translations.MobileReplyThreadsInputFieldTitle,
    name: 'mobile reply threads',
    dataTestId: 'mobileReplyThreads',
};

const sameMobileSettingsDesktopInputFieldData: FieldsetCheckbox = {
    title: translations.sameMobileSettingsDesktopInputFieldTitle,
    name: 'same mobile settings as Desktop',
    dataTestId: 'sameMobileSettingsDesktop',
};

const IgnoreMentionsInputFieldData: FieldsetCheckbox = {
    title: translations.IgnoreMentionsInputFieldTitle,
    name: 'ignore mentions',
    dataTestId: 'ignoreMentions',
};

const AutoFollowThreadsInputFieldData: FieldsetCheckbox = {
    title: translations.AutoFollowThreadsInputFieldTitle,
    name: 'auto follow threads',
    dataTestId: 'autoFollowThreads',
};

const desktopNotificationInputFieldData = (defaultOption: string): FieldsetRadio => {
    return {
        options: [
            {
                dataTestId: `desktopNotification-${NotificationLevels.ALL}`,
                title: desktopNotificationInputFieldOptions.allNewMessages,
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
                title: desktopNotificationInputFieldOptions.mentions,
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
                title: desktopNotificationInputFieldOptions.nothing,
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

const mobileNotificationInputFieldData = (defaultOption: string): FieldsetRadio => {
    return {
        options: [
            {
                dataTestId: `MobileNotification-${NotificationLevels.ALL}`,
                title: mobileNotificationInputFieldOptions.allNewMessages,
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
                title: mobileNotificationInputFieldOptions.mentions,
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
                title: mobileNotificationInputFieldOptions.nothing,
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

const utils = {
    desktopNotificationInputFieldData,
    DesktopNotificationsSectionDesc: translations.DesktopNotificationsSectionDesc,
    DesktopNotificationsSectionTitle: translations.DesktopNotificationsSectionTitle,
    IgnoreMentionsDesc: translations.IgnoreMentionsDesc,
    IgnoreMentionsInputFieldData,
    mobileNotificationInputFieldData,
    MobileNotificationsSectionDesc: translations.MobileNotificationsSectionDesc,
    MobileNotificationsSectionTitle: translations.MobileNotificationsSectionTitle,
    MuteAndIgnoreSectionTitle: translations.MuteAndIgnoreSectionTitle,
    MuteChannelDesc: translations.MuteChannelDesc,
    MuteChannelInputFieldData,
    NotifyMeTitle: translations.NotifyMeTitle,
    DesktopReplyThreadsInputFieldData,
    ThreadsReplyTitle: translations.ThreadsReplyTitle,
    MobileReplyThreadsInputFieldData,
    AutoFollowThreadsTitle: translations.AutoFollowThreadsTitle,
    AutoFollowThreadsDesc: translations.AutoFollowThreadsDesc,
    AutoFollowThreadsInputFieldData,
    sameMobileSettingsDesktopInputFieldData,
};

export default utils;
