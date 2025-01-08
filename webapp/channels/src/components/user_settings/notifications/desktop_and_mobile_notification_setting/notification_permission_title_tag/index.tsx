// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';

import {useDesktopAppNotificationPermission} from 'components/common/hooks/use_desktop_notification_permission';
import Tag from 'components/widgets/tag/tag';

import {
    getNotificationPermission,
    isNotificationAPISupported,
    NotificationPermissionDenied,
    NotificationPermissionNeverGranted,
} from 'utils/notifications';

export default function NotificationPermissionTitleTag() {
    const {formatMessage} = useIntl();

    const [desktopNotificationPermission] = useDesktopAppNotificationPermission();

    if (!isNotificationAPISupported()) {
        return (
            <Tag
                size='sm'
                variant='danger'
                icon='alert-outline'
                text={formatMessage({
                    id: 'user.settings.notifications.desktopAndMobile.notificationSection.noPermissionIssueTag',
                    defaultMessage: 'Not supported',
                })}
            />
        );
    }

    if (
        getNotificationPermission() === NotificationPermissionNeverGranted ||
        getNotificationPermission() === NotificationPermissionDenied ||
        desktopNotificationPermission === NotificationPermissionDenied
    ) {
        return (
            <Tag
                size='sm'
                variant='dangerDim'
                icon='alert-outline'
                text={formatMessage({
                    id: 'user.settings.notifications.desktopAndMobile.notificationSection.permissionIssueTag',
                    defaultMessage: 'Permission required',
                })}
            />
        );
    }

    return null;
}
