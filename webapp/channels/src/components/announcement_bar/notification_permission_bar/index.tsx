// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useSelector} from 'react-redux';

import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';

import NotificationPermissionNeverGrantedBar from 'components/announcement_bar/notification_permission_bar/notification_permission_never_granted_bar';
import NotificationPermissionUnsupportedBar from 'components/announcement_bar/notification_permission_bar/notification_permission_unsupported_bar';
import {useDesktopAppNotificationPermission} from 'components/common/hooks/use_desktop_notification_permission';

import {
    isNotificationAPISupported,
    NotificationPermissionDenied,
    NotificationPermissionNeverGranted,
    getNotificationPermission,
} from 'utils/notifications';

export default function NotificationPermissionBar() {
    const isLoggedIn = Boolean(useSelector(getCurrentUserId));

    useDesktopAppNotificationPermission();

    if (!isLoggedIn) {
        return null;
    }

    // When browser does not support notification API, we show the notification bar to update browser
    if (!isNotificationAPISupported()) {
        return <NotificationPermissionUnsupportedBar/>;
    }

    // When user has not granted permission, we show the notification bar to request permission
    if (getNotificationPermission() === NotificationPermissionNeverGranted) {
        return <NotificationPermissionNeverGrantedBar/>;
    }

    // When user has denied permission, we don't show since user explicitly denied permission
    if (getNotificationPermission() === NotificationPermissionDenied) {
        return null;
    }

    return null;
}
