// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {defineMessage, FormattedMessage} from 'react-intl';

import type {FieldsetCheckbox} from 'components/widgets/modals/components/checkbox_setting_item';
import type {FieldsetRadio} from 'components/widgets/modals/components/radio_setting_item';
import type {FieldsetReactSelect} from 'components/widgets/modals/components/react_select_item';

import {NotificationLevels} from 'utils/constants';
import {optionsOfMessageNotificationSoundsSelect} from 'utils/notification_sounds';

const MuteChannelInputFieldData: FieldsetCheckbox = {
    name: 'mute channel',
    dataTestId: 'channel_notifications_modal.mute--checkbox',
};

const DesktopReplyThreadsInputFieldData: FieldsetCheckbox = {
    name: 'desktop reply threads',
    dataTestId: 'channel_notifications_modal.desktop_reply_threads--checkbox',
};

const MobileReplyThreadsInputFieldData: FieldsetCheckbox = {
    name: 'mobile reply threads',
    dataTestId: 'channel_notifications_modal.mobile_reply_threads--checkbox',
};

export const sameMobileSettingsDesktopInputFieldData: FieldsetCheckbox = {
    name: 'same mobile settings as Desktop',
    dataTestId: 'channel_notifications_modal.same_mobile_as_desktop--checkbox',
};

export const IgnoreMentionsInputFieldData: FieldsetCheckbox = {
    name: 'ignore mentions',
    dataTestId: 'channel_notifications_modal.ignore_mentions--checkbox',
};

export const AutoFollowThreadsInputFieldData: FieldsetCheckbox = {
    name: 'auto follow threads',
    dataTestId: 'channel_notifications_modal.auto_follow_threads--checkbox',
};

const defaultMessage = defineMessage({
    id: 'channel_notifications.default',
    defaultMessage: '(default)',
});

export const desktopNotificationInputFieldData = (defaultOption: string): FieldsetRadio => ({
    options: [
        {
            title: (
                <FormattedMessage
                    id='channelNotifications.desktopNotification.allMessages'
                    defaultMessage='All new messages {optionalDefault}'
                    values={{
                        optionalDefault: defaultOption === NotificationLevels.ALL ? (
                            <FormattedMessage
                                {...defaultMessage}
                            />) : undefined,
                    }}
                />
            ),
            dataTestId: 'channel_notifications_modal.desktop.all--radio',
            name: 'desktop',
            key: `desktopNotification-${NotificationLevels.ALL}`,
            value: NotificationLevels.ALL,
        },
        {
            title: (
                <FormattedMessage
                    id='channelNotifications.desktopNotification.mention'
                    defaultMessage='Mentions, direct messages, and keywords only {optionalDefault}'
                    values={{
                        optionalDefault: defaultOption === NotificationLevels.MENTION ? (
                            <FormattedMessage
                                {...defaultMessage}
                            />) : undefined,
                    }}
                />
            ),
            dataTestId: 'channel_notifications_modal.desktop.mention--radio',
            name: 'desktop',
            key: `desktopNotification-${NotificationLevels.MENTION}`,
            value: NotificationLevels.MENTION,
        },
        {
            title: (
                <FormattedMessage
                    id='channelNotifications.desktopNotification.nothing'
                    defaultMessage='Nothing {optionalDefault}'
                    values={{
                        optionalDefault: defaultOption === NotificationLevels.NONE ? (
                            <FormattedMessage
                                {...defaultMessage}
                            />) : undefined,
                    }}
                />
            ),
            dataTestId: 'channel_notifications_modal.desktop.none--radio',
            name: 'desktop',
            key: `desktopNotification-${NotificationLevels.NONE}`,
            value: NotificationLevels.NONE,
        },
    ],
}
);

export const desktopNotificationSoundsCheckboxFieldData: FieldsetCheckbox = {
    name: 'desktopNotificationSoundsCheckbox',
    dataTestId: 'channel_notifications_modal.desktop_sound--checkbox',
};

export const desktopNotificationSoundsSelectFieldData: FieldsetReactSelect = {
    id: 'desktopNotificationSoundsSelect',
    inputId: 'desktopNotificationSoundsSelectInputId',
    options: optionsOfMessageNotificationSoundsSelect,
};

export const mobileNotificationInputFieldData = (defaultOption: string): FieldsetRadio => ({
    options: [
        {
            title: (
                <FormattedMessage
                    id='channelNotifications.mobileNotification.newMessages'
                    defaultMessage='All new messages {optionalDefault}'
                    values={{
                        optionalDefault: defaultOption === NotificationLevels.ALL ? (
                            <FormattedMessage
                                {...defaultMessage}
                            />) : undefined,
                    }}
                />
            ),
            dataTestId: 'channel_notifications_modal.mobile.all--radio',
            name: 'push',
            key: `MobileNotification-${NotificationLevels.ALL}`,
            value: NotificationLevels.ALL,
        },
        {
            title: (
                <FormattedMessage

                    id='channelNotifications.mobileNotification.mention'
                    defaultMessage='Mentions, direct messages, and keywords only {optionalDefault}'
                    values={{
                        optionalDefault: defaultOption === NotificationLevels.MENTION ? (
                            <FormattedMessage
                                {...defaultMessage}
                            />) : undefined,
                    }}
                />
            ),
            dataTestId: 'channel_notifications_modal.mobile.mention--radio',
            name: 'push',
            key: `MobileNotification-${NotificationLevels.MENTION}`,
            value: NotificationLevels.MENTION,
        },
        {
            title: (
                <FormattedMessage
                    id='channelNotifications.mobileNotification.nothing'
                    defaultMessage='Nothing {optionalDefault}'
                    values={{
                        optionalDefault: defaultOption === NotificationLevels.NONE ? (
                            <FormattedMessage
                                {...defaultMessage}
                            />) : undefined,
                    }}
                />
            ),
            dataTestId: 'channel_notifications_modal.mobile.none--radio',
            name: 'push',
            key: `MobileNotification-${NotificationLevels.NONE}`,
            value: NotificationLevels.NONE,
        },
    ],
}
);

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
