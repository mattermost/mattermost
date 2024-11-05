// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useState} from 'react';
import {useIntl} from 'react-intl';

import type {DesktopNotificationPermission} from 'components/common/hooks/use_desktop_notification_permission';
import {getDesktopAppNotificationPermission} from 'components/common/hooks/use_desktop_notification_permission';
import Tag from 'components/widgets/tag/tag';

import {
    getNotificationPermission,
    isNotificationAPISupported,
    NotificationPermissionDenied,
    NotificationPermissionNeverGranted,
} from 'utils/notifications';

export default function NotificationPermissionTitleTag() {
    const {formatMessage} = useIntl();

    const [desktopNotificationPermission, setDesktopNotificationPermission] = useState<DesktopNotificationPermission>(undefined);

    useEffect(() => {
        async function getDesktopAppNotificationPermissionAndSetState() {
            const permission = await getDesktopAppNotificationPermission();
            setDesktopNotificationPermission(permission);
        }

        getDesktopAppNotificationPermissionAndSetState();
    }, []);

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
