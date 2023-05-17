// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import {NotificationSections} from 'utils/constants';

import './section_title.scss';

type Props = {
    section: string;
    isExpanded?: boolean;
    isNotificationsSettingSameAsGlobal?: boolean;
    onClickResetButton?: () => void;
}

export default function SectionTitle({section, isExpanded, isNotificationsSettingSameAsGlobal, onClickResetButton}: Props) {
    if (section === NotificationSections.DESKTOP || section === NotificationSections.PUSH) {
        return (
            <div className='SectionTitle__wrapper'>
                {section === NotificationSections.DESKTOP &&
                <FormattedMessage
                    id='channel_notifications.desktopNotifications'
                    defaultMessage='Desktop notifications'
                />}

                {section === NotificationSections.PUSH &&
                <FormattedMessage
                    id='channel_notifications.push'
                    defaultMessage='Mobile push notifications'
                />}
                {isExpanded && !isNotificationsSettingSameAsGlobal &&
                <button
                    className='SectionTitle__resetButton color--link'
                    onClick={onClickResetButton}
                >
                    <i className='icon icon-refresh'/>
                    <FormattedMessage
                        id='channel_notifications.resetToDefaults'
                        defaultMessage='Reset to defaults'
                    />
                </button>
                }
            </div>
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
