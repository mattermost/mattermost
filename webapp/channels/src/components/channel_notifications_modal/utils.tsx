// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import type {FieldsetCheckbox} from 'components/widgets/modals/components/checkbox_setting_item';
import type {FieldsetRadio} from 'components/widgets/modals/components/radio_setting_item';
import type {FieldsetReactSelect} from 'components/widgets/modals/components/react_select_item';

import {NotificationLevels} from 'utils/constants';
import {optionsOfMessageNotificationSoundsSelect} from 'utils/notification_sounds';

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
                        id='channelNotifications.desktopNotification.allMessages'
                        defaultMessage='All new messages {optionalDefault}'
                        values={{
                            optionalDefault: defaultOption === NotificationLevels.ALL ? (
                                <FormattedMessage
                                    id='channel_notifications.default'
                                    defaultMessage='(default)'
                                />) : undefined,
                        }}
                    />
                ),
                name: `desktopNotification-${NotificationLevels.ALL}`,
                key: `desktopNotification-${NotificationLevels.ALL}`,
                value: NotificationLevels.ALL,
            },
            {
                dataTestId: `desktopNotification-${NotificationLevels.MENTION}`,
                title: (
                    <FormattedMessage
                        id='channelNotifications.desktopNotification.mention'
                        defaultMessage='Mentions, direct messages, and keywords only {optionalDefault}'
                        values={{
                            optionalDefault: defaultOption === NotificationLevels.MENTION ? (
                                <FormattedMessage
                                    id='channel_notifications.default'
                                    defaultMessage='(default)'
                                />) : undefined,
                        }}
                    />
                ),
                name: `desktopNotification-${NotificationLevels.MENTION}`,
                key: `desktopNotification-${NotificationLevels.MENTION}`,
                value: NotificationLevels.MENTION,
            },
            {
                dataTestId: `desktopNotification-${NotificationLevels.NONE}`,
                title: (
                    <FormattedMessage
                        id='channelNotifications.desktopNotification.nothing'
                        defaultMessage='Nothing {optionalDefault}'
                        values={{
                            optionalDefault: defaultOption === NotificationLevels.NONE ? (
                                <FormattedMessage
                                    id='channel_notifications.default'
                                    defaultMessage='(default)'
                                />) : undefined,
                        }}
                    />
                ),
                name: `desktopNotification-${NotificationLevels.NONE}`,
                key: `desktopNotification-${NotificationLevels.NONE}`,
                value: NotificationLevels.NONE,
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
                        id='channelNotifications.mobileNotification.newMessages'
                        defaultMessage='All new messages {optionalDefault}'
                        values={{
                            optionalDefault: defaultOption === NotificationLevels.ALL ? (
                                <FormattedMessage
                                    id='channel_notifications.default'
                                    defaultMessage='(default)'
                                />) : undefined,
                        }}
                    />
                ),
                name: `MobileNotification-${NotificationLevels.ALL}`,
                key: `MobileNotification-${NotificationLevels.ALL}`,
                value: NotificationLevels.ALL,
            },
            {
                dataTestId: `MobileNotification-${NotificationLevels.MENTION}`,
                title: (
                    <FormattedMessage
                        id='channelNotifications.mobileNotification.mention'
                        defaultMessage='Mentions, direct messages, and keywords only {optionalDefault}'
                        values={{
                            optionalDefault: defaultOption === NotificationLevels.MENTION ? (
                                <FormattedMessage
                                    id='channel_notifications.default'
                                    defaultMessage='(default)'
                                />) : undefined,
                        }}
                    />
                ),
                name: `MobileNotification-${NotificationLevels.MENTION}`,
                key: `MobileNotification-${NotificationLevels.MENTION}`,
                value: NotificationLevels.MENTION,
            },
            {
                dataTestId: `MobileNotification-${NotificationLevels.NONE}`,
                title: (
                    <FormattedMessage
                        id='channelNotifications.mobileNotification.nothing'
                        defaultMessage='Nothing {optionalDefault}'
                        values={{
                            optionalDefault: defaultOption === NotificationLevels.NONE ? (
                                <FormattedMessage
                                    id='channel_notifications.default'
                                    defaultMessage='(default)'
                                />) : undefined,
                        }}
                    />
                ),
                name: `MobileNotification-${NotificationLevels.NONE}`,
                key: `MobileNotification-${NotificationLevels.NONE}`,
                value: NotificationLevels.NONE,
            },
        ],
    };
};

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
