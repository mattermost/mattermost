// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {defineMessage, defineMessages, FormattedMessage, type IntlShape} from 'react-intl';

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

const defaultMessage = defineMessage({
    id: 'channel_notifications.default',
    defaultMessage: '(default)',
});

export const desktopNotificationInputFieldData = (defaultOption: string, formatMessage: IntlShape['formatMessage']): FieldsetRadio => {
    const messages = defineMessages({
        allMessages: {
            id: 'channelNotifications.desktopNotification.allMessages',
            defaultMessage: 'All new messages {optionalDefault}',

        },
        mention: {
            id: 'channelNotifications.desktopNotification.mention',
            defaultMessage: 'Mentions, direct messages, and keywords only {optionalDefault}',
        },
        nothing: {
            id: 'channelNotifications.desktopNotification.nothing',
            defaultMessage: 'Nothing {optionalDefault}',
        },
    });

    return {
        options: [
            {
                dataTestId: `desktopNotification-${NotificationLevels.ALL}`,
                title: (
                    <FormattedMessage
                        {...messages.allMessages}
                        values={{
                            optionalDefault: defaultOption === NotificationLevels.ALL ? (
                                <FormattedMessage
                                    {...defaultMessage}
                                />) : undefined,
                        }}
                    />
                ),
                name: formatMessage(messages.allMessages, {
                    optionalDefault: defaultOption === NotificationLevels.ALL ? (
                        formatMessage(defaultMessage)
                    ) : undefined,
                }),
                key: `desktopNotification-${NotificationLevels.ALL}`,
                value: NotificationLevels.ALL,
            },
            {
                dataTestId: `desktopNotification-${NotificationLevels.MENTION}`,
                title: (
                    <FormattedMessage
                        {...messages.mention}
                        values={{
                            optionalDefault: defaultOption === NotificationLevels.MENTION ? (
                                <FormattedMessage
                                    {...defaultMessage}
                                />) : undefined,
                        }}
                    />
                ),
                name: formatMessage(messages.mention, {
                    optionalDefault: defaultOption === NotificationLevels.MENTION ? (
                        formatMessage(defaultMessage)
                    ) : undefined,
                }),
                key: `desktopNotification-${NotificationLevels.MENTION}`,
                value: NotificationLevels.MENTION,
            },
            {
                dataTestId: `desktopNotification-${NotificationLevels.NONE}`,
                title: (
                    <FormattedMessage
                        {...messages.nothing}
                        values={{
                            optionalDefault: defaultOption === NotificationLevels.NONE ? (
                                <FormattedMessage
                                    {...defaultMessage}
                                />) : undefined,
                        }}
                    />
                ),
                name: formatMessage(messages.nothing, {
                    optionalDefault: defaultOption === NotificationLevels.NONE ? (
                        formatMessage(defaultMessage)
                    ) : undefined,
                }),
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

export const mobileNotificationInputFieldData = (defaultOption: string, formatMessage: IntlShape['formatMessage']): FieldsetRadio => {
    const messages = defineMessages({
        allMessages: {
            id: 'channelNotifications.mobileNotification.newMessages',
            defaultMessage: 'All new messages {optionalDefault}',

        },
        mention: {
            id: 'channelNotifications.mobileNotification.mention',
            defaultMessage: 'Mentions, direct messages, and keywords only {optionalDefault}',
        },
        nothing: {
            id: 'channelNotifications.mobileNotification.nothing',
            defaultMessage: 'Nothing {optionalDefault}',
        },
    });

    return {
        options: [
            {
                dataTestId: `MobileNotification-${NotificationLevels.ALL}`,
                title: (
                    <FormattedMessage
                        {...messages.allMessages}
                        values={{
                            optionalDefault: defaultOption === NotificationLevels.ALL ? (
                                <FormattedMessage
                                    {...defaultMessage}
                                />) : undefined,
                        }}
                    />
                ),

                name: formatMessage(messages.allMessages, {
                    optionalDefault: defaultOption === NotificationLevels.ALL ? (
                        formatMessage(defaultMessage)
                    ) : undefined,
                }),
                key: `MobileNotification-${NotificationLevels.ALL}`,
                value: NotificationLevels.ALL,
            },
            {
                dataTestId: `MobileNotification-${NotificationLevels.MENTION}`,
                title: (
                    <FormattedMessage

                        {...messages.mention}
                        values={{
                            optionalDefault: defaultOption === NotificationLevels.MENTION ? (
                                <FormattedMessage
                                    {...defaultMessage}
                                />) : undefined,
                        }}
                    />
                ),
                name: formatMessage(messages.mention, {
                    optionalDefault: defaultOption === NotificationLevels.MENTION ? (
                        formatMessage(defaultMessage)
                    ) : undefined,
                }),
                key: `MobileNotification-${NotificationLevels.MENTION}`,
                value: NotificationLevels.MENTION,
            },
            {
                dataTestId: `MobileNotification-${NotificationLevels.NONE}`,
                title: (
                    <FormattedMessage
                        {...messages.nothing}
                        values={{
                            optionalDefault: defaultOption === NotificationLevels.NONE ? (
                                <FormattedMessage
                                    {...defaultMessage}
                                />) : undefined,
                        }}
                    />
                ),
                name: formatMessage(messages.nothing, {
                    optionalDefault: defaultOption === NotificationLevels.NONE ? (
                        formatMessage(defaultMessage)
                    ) : undefined,
                }),
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
