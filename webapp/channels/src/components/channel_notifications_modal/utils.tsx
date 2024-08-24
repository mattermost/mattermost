// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import type {ChannelMembership, ChannelNotifyProps} from '@mattermost/types/channels';
import type {UserNotifyProps} from '@mattermost/types/users';

import type {FieldsetCheckbox} from 'components/widgets/modals/components/checkbox_setting_item';
import type {FieldsetRadio} from 'components/widgets/modals/components/radio_setting_item';
import type {FieldsetReactSelect} from 'components/widgets/modals/components/react_select_item';

import {DesktopSound, IgnoreChannelMentions, NotificationLevels} from 'utils/constants';
import {notificationSoundKeys, optionsOfMessageNotificationSoundsSelect} from 'utils/notification_sounds';

const MuteChannelInputFieldData: FieldsetCheckbox = {
    name: 'mute channel',
    dataTestId: 'muteChannel',
};

const DesktopReplyThreadsInputFieldData: FieldsetCheckbox = {
    name: 'desktop reply threads',
    dataTestId: 'desktopReplyThreads',
};

const MobileReplyThreadsInputFieldData: FieldsetCheckbox = {
    name: 'mobile reply threads',
    dataTestId: 'mobileReplyThreads',
};

export const sameMobileSettingsDesktopInputFieldData: FieldsetCheckbox = {
    name: 'same mobile settings as Desktop',
    dataTestId: 'sameMobileSettingsDesktop',
};

export const IgnoreMentionsInputFieldData: FieldsetCheckbox = {
    name: 'ignore mentions',
    dataTestId: 'ignoreMentions',
};

export const AutoFollowThreadsInputFieldData: FieldsetCheckbox = {
    name: 'auto follow threads',
    dataTestId: 'autoFollowThreads',
};

export const desktopNotificationInputFieldData = (defaultOption: string): FieldsetRadio => {
    return {
        options: [
            {
                dataTestId: `desktopNotification-${NotificationLevels.ALL}`,
                title: (
                    <FormattedMessage
                        id='channel_notifications.desktopNotificationAllLabel'
                        defaultMessage='All new messages'
                    />
                ),
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
                title: (
                    <FormattedMessage
                        id='channel_notifications.desktopNotificationMentionLabel'
                        defaultMessage='Mentions, direct messages, and keywords only'
                    />
                ),
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
                title: (
                    <FormattedMessage
                        id='channel_notifications.desktopNotificationNothingLabel'
                        defaultMessage='Nothing'
                    />
                ),
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

export const desktopNotificationSoundsCheckboxFieldData: FieldsetCheckbox = {
    name: 'desktopNotificationSoundsCheckbox',
    dataTestId: 'desktopNotificationSoundsCheckbox',
};

export const desktopNotificationSoundsSelectFieldData: FieldsetReactSelect = {
    id: 'desktopNotificationSoundsSelect',
    inputId: 'desktopNotificationSoundsSelectInputId',
    options: optionsOfMessageNotificationSoundsSelect,
};

export const mobileNotificationInputFieldData = (defaultOption: string): FieldsetRadio => {
    return {
        options: [
            {
                dataTestId: `MobileNotification-${NotificationLevels.ALL}`,
                title: (
                    <FormattedMessage
                        id='channel_notifications.MobileNotificationAllLabel'
                        defaultMessage='All new messages'
                    />
                ),
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
                title: (
                    <FormattedMessage
                        id='channel_notifications.MobileNotificationMentionLabel'
                        defaultMessage='Mentions, direct messages, and keywords only'
                    />
                ),
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
                title: (
                    <FormattedMessage
                        id='channel_notifications.MobileNotificationNothingLabel'
                        defaultMessage='Nothing'
                    />
                ),
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

/**
 * This conversion is needed because User's preference for desktop sound is stored as either true or false. On the other hand,
 * Channel's specific desktop sound is stored as either On or Off.
 */
export function convertDesktopSoundNotifyPropFromUserToDesktop(userNotifyDesktopSound?: UserNotifyProps['desktop_sound']): ChannelNotifyProps['desktop_sound'] {
    if (userNotifyDesktopSound && userNotifyDesktopSound === 'false') {
        return DesktopSound.OFF;
    }

    return DesktopSound.ON;
}

export function getInitialValuesOfChannelNotifyProps<T extends keyof ChannelNotifyProps>(
    selectedNotifyProps: T,
    currentUserNotifyProps: UserNotifyProps,
    channelMemberNotifyProps?: ChannelMembership['notify_props']): ChannelNotifyProps[T] {
    if (selectedNotifyProps === 'desktop') {
        let desktop: ChannelNotifyProps['desktop'];
        if (channelMemberNotifyProps && channelMemberNotifyProps.desktop) {
            if (channelMemberNotifyProps.desktop === NotificationLevels.DEFAULT) {
                desktop = currentUserNotifyProps.desktop;
            } else {
                desktop = channelMemberNotifyProps.desktop;
            }
        } else {
            desktop = currentUserNotifyProps.desktop;
        }

        return desktop as ChannelNotifyProps[T];
    }

    if (selectedNotifyProps === 'desktop_threads') {
        let desktopThreads: ChannelNotifyProps['desktop_threads'];
        if (channelMemberNotifyProps && channelMemberNotifyProps.desktop_threads) {
            desktopThreads = channelMemberNotifyProps.desktop_threads;
        } else if (currentUserNotifyProps.desktop_threads) {
            desktopThreads = currentUserNotifyProps.desktop_threads;
        } else {
            desktopThreads = NotificationLevels.ALL;
        }

        return desktopThreads as ChannelNotifyProps[T];
    }

    if (selectedNotifyProps === 'desktop_sound') {
        let desktopSound: ChannelNotifyProps['desktop_sound'];
        if (channelMemberNotifyProps && channelMemberNotifyProps.desktop_sound) {
            desktopSound = channelMemberNotifyProps.desktop_sound;
        } else {
            desktopSound = convertDesktopSoundNotifyPropFromUserToDesktop(currentUserNotifyProps.desktop_sound);
        }

        return desktopSound as ChannelNotifyProps[T];
    }

    if (selectedNotifyProps === 'desktop_notification_sound') {
        let desktopNotificationSound: ChannelNotifyProps['desktop_notification_sound'];
        if (channelMemberNotifyProps && channelMemberNotifyProps.desktop_notification_sound) {
            desktopNotificationSound = channelMemberNotifyProps.desktop_notification_sound;
        } else if (currentUserNotifyProps && currentUserNotifyProps.desktop_notification_sound) {
            desktopNotificationSound = currentUserNotifyProps.desktop_notification_sound;
        } else {
            desktopNotificationSound = notificationSoundKeys[0] as ChannelNotifyProps['desktop_notification_sound'];
        }

        return desktopNotificationSound as ChannelNotifyProps[T];
    }

    if (selectedNotifyProps === 'push') {
        let push: ChannelNotifyProps['push'];
        if (channelMemberNotifyProps && channelMemberNotifyProps.push) {
            if (channelMemberNotifyProps.push === NotificationLevels.DEFAULT) {
                push = currentUserNotifyProps.push;
            } else {
                push = channelMemberNotifyProps.push;
            }
        } else {
            push = currentUserNotifyProps.push;
        }

        return push as ChannelNotifyProps[T];
    }

    if (selectedNotifyProps === 'push_threads') {
        let pushThreads;
        if (channelMemberNotifyProps && channelMemberNotifyProps.push_threads) {
            pushThreads = channelMemberNotifyProps.push_threads;
        } else if (currentUserNotifyProps && currentUserNotifyProps.push_threads) {
            pushThreads = currentUserNotifyProps.push_threads;
        } else {
            pushThreads = NotificationLevels.ALL;
        }

        return pushThreads as ChannelNotifyProps[T];
    }

    if (selectedNotifyProps === 'ignore_channel_mentions') {
        let ignoreChannelMentionsDefault: ChannelNotifyProps['ignore_channel_mentions'] = IgnoreChannelMentions.OFF;

        if (channelMemberNotifyProps?.mark_unread === NotificationLevels.MENTION || (currentUserNotifyProps.channel && currentUserNotifyProps.channel === 'false')) {
            ignoreChannelMentionsDefault = IgnoreChannelMentions.ON;
        }

        let ignoreChannelMentions = channelMemberNotifyProps?.ignore_channel_mentions;
        if (!ignoreChannelMentions || ignoreChannelMentions === IgnoreChannelMentions.DEFAULT) {
            ignoreChannelMentions = ignoreChannelMentionsDefault;
        }

        return ignoreChannelMentions as ChannelNotifyProps[T];
    }

    return undefined as ChannelNotifyProps[T];
}

export default {
    desktopNotificationInputFieldData,
    desktopNotificationSoundsCheckboxFieldData,
    desktopNotificationSoundsSelectFieldData,
    IgnoreMentionsInputFieldData,
    mobileNotificationInputFieldData,
    MuteChannelInputFieldData,
    DesktopReplyThreadsInputFieldData,
    MobileReplyThreadsInputFieldData,
    AutoFollowThreadsInputFieldData,
    sameMobileSettingsDesktopInputFieldData,
};
