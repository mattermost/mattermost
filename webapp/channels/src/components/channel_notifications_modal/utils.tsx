// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import type {ChannelNotifyProps} from '@mattermost/types/channels';
import type {UserNotifyProps} from '@mattermost/types/users';

import type {FieldsetCheckbox} from 'components/widgets/modals/components/checkbox_setting_item';
import type {FieldsetRadio} from 'components/widgets/modals/components/radio_setting_item';

import {NotificationLevels} from 'utils/constants';

export type ChannelMemberNotifyProps = Partial<ChannelNotifyProps> & Pick<UserNotifyProps, 'desktop_threads' | 'push_threads'>

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

const utils = {
    desktopNotificationInputFieldData,
    IgnoreMentionsInputFieldData,
    mobileNotificationInputFieldData,
    MuteChannelInputFieldData,
    DesktopReplyThreadsInputFieldData,
    MobileReplyThreadsInputFieldData,
    AutoFollowThreadsInputFieldData,
    sameMobileSettingsDesktopInputFieldData,
};

export default utils;
