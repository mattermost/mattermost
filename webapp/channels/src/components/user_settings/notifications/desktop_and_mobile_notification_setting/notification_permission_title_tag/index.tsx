// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';

import {AlertOutlineIcon} from '@mattermost/compass-icons/components';
import {Tag} from '@mattermost/design-system';

import {useDesktopAppNotificationPermission} from 'components/common/hooks/use_desktop_notification_permission';

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
                icon={<AlertOutlineIcon size={16}/>}
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
                icon={<AlertOutlineIcon size={16}/>}
                text={formatMessage({
                    id: 'user.settings.notifications.desktopAndMobile.notificationSection.permissionIssueTag',
                    defaultMessage: 'Permission required',
                })}
            />
        );
    }

    return null;
}
