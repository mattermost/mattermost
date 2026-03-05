// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useSelector} from 'react-redux';

import {getCloudSubscription} from 'mattermost-redux/selectors/entities/cloud';
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
import * as UserAgent from 'utils/user_agent';

export default function NotificationPermissionBar() {
    const isLoggedIn = Boolean(useSelector(getCurrentUserId));
    const subscription = useSelector(getCloudSubscription);

    useDesktopAppNotificationPermission();

    if (!isLoggedIn) {
        return null;
    }

    // Don't show the notification bar if it's a cloud preview environment
    if (subscription?.is_cloud_preview) {
        return null;
    }

    // When browser does not support notification API, we show the notification bar to update browser
    // Don't show for MS 365 mobile apps (Teams, Outlook) as they intentionally don't support notifications
    if (!isNotificationAPISupported() && !UserAgent.isM365Mobile()) {
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
