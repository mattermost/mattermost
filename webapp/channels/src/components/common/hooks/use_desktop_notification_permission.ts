// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useEffect, useState} from 'react';

import {type NotificationPermissionNeverGranted} from 'utils/notifications';
import {isNotificationAPISupported} from 'utils/notifications';
import {isDesktopApp} from 'utils/user_agent';

type DesktopNotificationPermission = Exclude<NotificationPermission, typeof NotificationPermissionNeverGranted> | undefined;

// This is a hook that is used to request notification permission for desktop app
// it also returns the permission state. We use this as a workaround for Bug with Electron - https://github.com/electron/electron/issues/11221
// tl;dr Electron always show 'granted' when queries for Notification.permission, hence this workaround
export function useDesktopAppNotificationPermission() {
    const [desktopResolvePermission, setDesktopResolvePermission] = useState<DesktopNotificationPermission>(undefined);

    useEffect(() => {
        if (!isDesktopApp()) {
            return;
        }

        if (!isNotificationAPISupported()) {
            return;
        }

        async function requestNotificationPermission() {
            // Based on Electron's notification permission it will have following states
            // - allowed - No further action needed
            // - denied permanently - No further action needed
            // - denied (temporary) - In this case, electron notification permission dialog is shown with requestPermission()
            const permission = await Notification.requestPermission();
            setDesktopResolvePermission(permission as DesktopNotificationPermission);
        }

        requestNotificationPermission();
    }, []);

    return desktopResolvePermission;
}
