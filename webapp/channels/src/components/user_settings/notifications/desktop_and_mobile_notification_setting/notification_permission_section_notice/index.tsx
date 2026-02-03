// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';

import {useDesktopAppNotificationPermission} from 'components/common/hooks/use_desktop_notification_permission';
import NotificationPermissionDeniedNotice from 'components/user_settings/notifications/desktop_and_mobile_notification_setting/notification_permission_section_notice/notification_permission_denied_section_notice';
import NotificationPermissionNeverGrantedNotice from 'components/user_settings/notifications/desktop_and_mobile_notification_setting/notification_permission_section_notice/notification_permission_never_granted_section_notice';
import NotificationPermissionUnsupportedSectionNotice from 'components/user_settings/notifications/desktop_and_mobile_notification_setting/notification_permission_section_notice/notification_permission_unsupported_section_notice';

import {getNotificationPermission, isNotificationAPISupported, NotificationPermissionDenied, NotificationPermissionNeverGranted} from 'utils/notifications';
import * as UserAgent from 'utils/user_agent';

import NotificationPermissionDesktopDeniedSectionNotice from './notification_permission_desktop_denied_section_notice';

export default function NotificationPermissionSectionNotice() {
    const isNotificationSupported = isNotificationAPISupported();

    const [notificationPermission, setNotificationPermission] = useState(getNotificationPermission());

    const [desktopNotificationPermission, requestDesktopNotificationPermission] = useDesktopAppNotificationPermission();

    function handleRequestNotificationClicked(permission: NotificationPermission) {
        setNotificationPermission(permission);
    }

    // Don't show unsupported notice for MS 365 mobile apps (Teams, Outlook) as they intentionally don't support notifications
    if (!isNotificationSupported && !UserAgent.isM365Mobile()) {
        return <NotificationPermissionUnsupportedSectionNotice/>;
    }

    if (desktopNotificationPermission === NotificationPermissionDenied) {
        return <NotificationPermissionDesktopDeniedSectionNotice requestDesktopNotificationPermission={requestDesktopNotificationPermission}/>;
    }

    if (isNotificationSupported && notificationPermission === NotificationPermissionNeverGranted) {
        return <NotificationPermissionNeverGrantedNotice onCtaButtonClick={handleRequestNotificationClicked}/>;
    }

    if (isNotificationSupported && notificationPermission === NotificationPermissionDenied) {
        return <NotificationPermissionDeniedNotice/>;
    }

    return null;
}

