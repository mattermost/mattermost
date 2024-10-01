// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useState} from 'react';
import {useIntl} from 'react-intl';

import SectionNotice from 'components/section_notice';

import {isNotificationAPISupported, NotificationPermissionDenied, NotificationPermissionNeverGranted, requestNotificationPermission} from 'utils/notifications';

export default function NotificationPermissionSectionNotice() {
    if (!isNotificationAPISupported()) {
        return null;
    }

    if (isNotificationAPISupported() && Notification.permission === NotificationPermissionNeverGranted) {
        return <NotificationPermissionNeverGrantedNotice/>;
    }

    if (isNotificationAPISupported() && Notification.permission === NotificationPermissionDenied) {
        return <NotificationPermissionDeniedNotice/>;
    }

    return null;
}

function NotificationPermissionNeverGrantedNotice() {
    const [show, setShow] = useState(true);

    const intl = useIntl();

    const handleClick = useCallback(async () => {
        await requestNotificationPermission();
        setShow(false);
    }, []);

    // This is here to have the notice disappear after the permission prompt process is complete
    if (!show) {
        return null;
    }

    return (
        <div className='extraContentBeforeSettingList'>
            <SectionNotice
                type='danger'
                title={intl.formatMessage({
                    id: 'user.settings.notifications.desktopAndMobile.notificationSection.permissionNeverGranted.title',
                    defaultMessage: 'Notifications are disabled',
                })}
                text={intl.formatMessage({
                    id: 'user.settings.notifications.desktopAndMobile.notificationSection.permissionNeverGranted.message',
                    defaultMessage: 'You\'re missing important message and call notifications from Mattermost. Mattermost notifications are disabled by this web browser.',
                })}
                primaryButton={{
                    text: intl.formatMessage({
                        id: 'user.settings.notifications.desktopAndMobile.notificationSection.permissionNeverGranted.button',
                        defaultMessage: 'Enable desktop notifications',
                    }),
                    onClick: handleClick,
                }}
            />
        </div>
    );
}

function NotificationPermissionDeniedNotice() {
    const intl = useIntl();

    const handleClick = useCallback(() => {
        // TODO: Change to Docs URL
        window.open('https://www.google.com', '_blank', 'noopener,noreferrer');
    }, []);

    return (
        <div className='extraContentBeforeSettingList'>
            <SectionNotice
                type='danger'
                title={intl.formatMessage({
                    id: 'user.settings.notifications.desktopAndMobile.notificationSection.permissionDenied.title',
                    defaultMessage: 'Desktop notifications permission was denied',
                })}
                text={intl.formatMessage({
                    id: 'user.settings.notifications.desktopAndMobile.notificationSection.permissionDenied.message',
                    defaultMessage: 'You\'re missing important message and call notifications from Mattermost. To start receiving notifications, please enable notifications for Mattermost in your browser settings.',
                })}
                primaryButton={{
                    text: intl.formatMessage({
                        id: 'user.settings.notifications.desktopAndMobile.notificationSection.permissionDenied.button',
                        defaultMessage: 'Learn how to enable desktop notifications',
                    }),
                    onClick: handleClick,
                }}
            />
        </div>
    );
}
