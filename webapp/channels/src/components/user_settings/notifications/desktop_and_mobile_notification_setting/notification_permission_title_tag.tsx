// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';

import Tag from 'components/widgets/tag/tag';

import {
    isNotificationAPISupported,
    NotificationPermissionDenied,
    NotificationPermissionNeverGranted,
} from 'utils/notifications';

export default function NotificationPermissionTitleTag() {
    const {formatMessage} = useIntl();

    if (!isNotificationAPISupported()) {
        <Tag
            size='sm'
            variant='danger'
            icon='alert-outline'
            text={formatMessage({
                id: 'user.settings.notifications.desktopAndMobile.notificationSection.noPermissionIssueTag',
                defaultMessage: 'Not supported',
            })}
        />;
    }

    if (
        (isNotificationAPISupported() && Notification.permission === NotificationPermissionNeverGranted) ||
        (isNotificationAPISupported() && Notification.permission === NotificationPermissionDenied)
    ) {
        return (
            <Tag
                size='sm'
                variant='danger'
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
