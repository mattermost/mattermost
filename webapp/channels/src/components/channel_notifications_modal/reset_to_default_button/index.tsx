// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useMemo} from 'react';
import {FormattedMessage} from 'react-intl';

import type {ChannelMembership, ChannelNotifyProps} from '@mattermost/types/channels';
import type {UserNotifyProps, UserProfile} from '@mattermost/types/users';

import {DesktopSound, NotificationLevels} from 'utils/constants';
import {notificationSoundKeys, convertDesktopSoundNotifyPropFromUserToDesktop} from 'utils/notification_sounds';

export enum SectionName {
    Desktop = 'desktop',
    Mobile = 'mobile',
}

const VALID_SECTION_NAMES = Object.values(SectionName);

export interface Props {
    sectionName: SectionName;
    userNotifyProps: UserProfile['notify_props'];

    /** The user's selected channel notify props which is not yet saved */
    userSelectedChannelNotifyProps: ChannelMembership['notify_props'];
    onClick: (channelNotifyPropsDefaultedToUserNotifyProps: ChannelMembership['notify_props'], sectionName: SectionName) => void;
}

export default function ResetToDefaultButton(props: Props) {
    const areDesktopNotificationsSameAsDefault = useMemo(() => {
        const isNotifyMeAboutSame = props.userNotifyProps.desktop === props.userSelectedChannelNotifyProps.desktop;
        const isThreadReplyNotificationsSame = props.userNotifyProps.desktop_threads === props.userSelectedChannelNotifyProps.desktop_threads;
        const isSoundSame = convertDesktopSoundNotifyPropFromUserToDesktop(props.userNotifyProps.desktop_sound) === props.userSelectedChannelNotifyProps.desktop_sound;

        let isNotificationSoundSame = false;
        if (props.userNotifyProps.desktop_notification_sound) {
            isNotificationSoundSame = props.userNotifyProps.desktop_notification_sound === props.userSelectedChannelNotifyProps.desktop_notification_sound;
        } else {
            // It could happen that the notification sound is not set in the user's notify props. That case we should assume its the Bing sound.
            isNotificationSoundSame = props.userSelectedChannelNotifyProps.desktop_notification_sound === notificationSoundKeys[0] as ChannelNotifyProps['desktop_notification_sound'];
        }

        return isNotifyMeAboutSame && isThreadReplyNotificationsSame && isSoundSame && isNotificationSoundSame;
    }, [
        props.userNotifyProps.desktop,
        props.userSelectedChannelNotifyProps.desktop,
        props.userNotifyProps.desktop_threads,
        props.userSelectedChannelNotifyProps.desktop_threads,
        props.userNotifyProps.desktop_sound,
        props.userSelectedChannelNotifyProps.desktop_sound,
        props.userNotifyProps.desktop_notification_sound,
        props.userSelectedChannelNotifyProps.desktop_notification_sound,
    ]);

    const areMobileNotificationsSameAsDefault = useMemo(() => {
        const isNotifyMeAboutSame = props.userNotifyProps.push === props.userSelectedChannelNotifyProps.push;
        const isThreadReplyNotificationsSame = props.userNotifyProps.push_threads === props.userSelectedChannelNotifyProps.push_threads;

        return isNotifyMeAboutSame && isThreadReplyNotificationsSame;
    }, [
        props.userNotifyProps.push,
        props.userSelectedChannelNotifyProps.push,
        props.userNotifyProps.push_threads,
        props.userSelectedChannelNotifyProps.push_threads,
    ]);

    if (!VALID_SECTION_NAMES.includes(props.sectionName)) {
        return null;
    }

    if (props.sectionName === SectionName.Desktop && areDesktopNotificationsSameAsDefault) {
        return null;
    }

    if (props.sectionName === SectionName.Mobile && areMobileNotificationsSameAsDefault) {
        return null;
    }

    function handleOnClick() {
        const channelNotifyPropsDefaultedToUserNotifyProps = resetChannelsNotificationToUsersDefault(props.userNotifyProps, props.sectionName);
        props.onClick(channelNotifyPropsDefaultedToUserNotifyProps, props.sectionName);
    }

    return (
        <button
            className='channel-notifications-settings-modal__reset-btn'
            onClick={handleOnClick}
            data-testid={`resetToDefaultButton-${props.sectionName}`}
        >
            <i className='icon icon-refresh'/>
            <FormattedMessage
                id='channel_notifications.resetToDefault'
                defaultMessage='Reset to default'
            />
        </button>
    );
}

export function resetChannelsNotificationToUsersDefault(userNotifyProps: UserNotifyProps, sectionName: SectionName): ChannelMembership['notify_props'] {
    if (sectionName === SectionName.Desktop) {
        return {
            desktop: userNotifyProps.desktop,
            desktop_threads: userNotifyProps?.desktop_threads ?? NotificationLevels.ALL,
            desktop_sound: userNotifyProps && userNotifyProps.desktop_sound ? convertDesktopSoundNotifyPropFromUserToDesktop(userNotifyProps.desktop_sound) : DesktopSound.ON,
            desktop_notification_sound: userNotifyProps?.desktop_notification_sound ?? notificationSoundKeys[0] as ChannelNotifyProps['desktop_notification_sound'],
        };
    }

    if (sectionName === SectionName.Mobile) {
        return {
            push: userNotifyProps.push,
            push_threads: userNotifyProps?.push_threads ?? NotificationLevels.ALL,
        };
    }

    return {};
}
