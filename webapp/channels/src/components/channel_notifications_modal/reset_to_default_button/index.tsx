// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import type {UserProfile} from '@mattermost/types/users';

export enum SectionName {
    Desktop = 'desktop',
    Mobile = 'mobile',
}

const VALID_SECTION_NAMES = Object.values(SectionName);

interface Props {
    sectionName: SectionName;
    userNotifyProps: UserProfile['notify_props'];
}

export default function ResetToDefaultButton(props: Props) {
    if (!VALID_SECTION_NAMES.includes(props.sectionName)) {
        return null;
    }

    function handleOnClick() {}

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

// const resetToDefaultBtn = useCallback((sectionName: string) => {
//     const userNotifyProps = {
//         ...props.currentUser.notify_props,
//         desktop_notification_sound: props.currentUser.notify_props?.desktop_notification_sound ?? notificationSoundKeys[0] as ChannelNotifyProps['desktop_notification_sound'],
//     };

//     function resetToDefault(sectionName: string) {
//         if (sectionName === 'desktop') {
//             setSettings({
//                 ...settings,
//                 desktop: userNotifyProps.desktop,
//                 desktop_threads: userNotifyProps.desktop_threads || settings.desktop_threads,
//                 desktop_sound: convertDesktopSoundNotifyPropFromUserToDesktop(userNotifyProps.desktop_sound),
//                 desktop_notification_sound: userNotifyProps?.desktop_notification_sound ?? notificationSoundKeys[0] as ChannelNotifyProps['desktop_notification_sound'],
//             });
//         }

//         if (sectionName === 'push') {
//             setSettings({...settings, push: userNotifyProps.desktop, push_threads: userNotifyProps.push_threads || settings.push_threads});
//         }
//     }

//     const isDesktopSameAsDefault =
//         userNotifyProps.desktop === settings.desktop &&
//         userNotifyProps.desktop_threads === settings.desktop_threads &&
//         userNotifyProps.desktop_notification_sound === settings.desktop_notification_sound &&
//         convertDesktopSoundNotifyPropFromUserToDesktop(userNotifyProps.desktop_sound) === settings.desktop_sound;

//     const isPushSameAsDefault = (userNotifyProps.push === settings.push && userNotifyProps.push_threads === settings.push_threads);

//     if ((sectionName === 'desktop' && isDesktopSameAsDefault) || (sectionName === 'push' && isPushSameAsDefault)) {
//         return undefined;
//     }

//     return (
//         <button
//             className='channel-notifications-settings-modal__reset-btn'
//             onClick={() => resetToDefault(sectionName)}
//             data-testid={`resetToDefaultButton-${sectionName}`}
//         >
//             <RefreshIcon
//                 size={14}
//                 color={'currentColor'}
//             />
//             <FormattedMessage
//                 id='channel_notifications.resetToDefault'
//                 defaultMessage='Reset to default'
//             />
//         </button>
//     );
// }, [props.currentUser.notify_props, settings]);
