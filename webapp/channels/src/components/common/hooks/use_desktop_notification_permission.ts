// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useCallback, useEffect, useState} from 'react';

import type {NotificationPermissionNeverGranted} from 'utils/notifications';
import {isNotificationAPISupported} from 'utils/notifications';
import {isDesktopApp} from 'utils/user_agent';

export type DesktopNotificationPermission = Exclude<NotificationPermission, typeof NotificationPermissionNeverGranted> | undefined;

// We store the permission state globally here to avoid calling requestPermission() multiple times
let desktopNotificationPermissionGlobalState: DesktopNotificationPermission | undefined;

// This is used to request notification permission for desktop app
// it also returns the permission state. We use this as a workaround for bug with Electron - https://github.com/electron/electron/issues/11221
// tl;dr Electron always show 'granted' when queries for Notification.permission, hence this workaround
export function useDesktopAppNotificationPermission(): [DesktopNotificationPermission, () => Promise<NotificationPermission>] {
    const [desktopNotificationPermission, setDesktopNotificationPermission] = useState<DesktopNotificationPermission>(undefined);

    const isDesktop = isDesktopApp();
    const isSupported = isNotificationAPISupported();

    const requestDesktopNotificationPermission = useCallback(async () => {
        // Based on Electron's notification permission it will have following states
        // - allowed - No further action needed
        // - denied permanently - No further action needed
        // - denied (temporary) - In this case, electron notification permission dialog is shown with requestPermission()
        const permission = await Notification.requestPermission();

        // Update the global state
        desktopNotificationPermissionGlobalState = permission as DesktopNotificationPermission;

        // Update the local state
        setDesktopNotificationPermission(permission as DesktopNotificationPermission);

        return permission;
    }, []);

    useEffect(() => {
        if (!isDesktop || !isSupported) {
            setDesktopNotificationPermission(undefined);
        } else if (desktopNotificationPermissionGlobalState === undefined) {
            // We are in initial state, we need to request permission now
            requestDesktopNotificationPermission();
        } else if (desktopNotificationPermissionGlobalState !== undefined) {
            setDesktopNotificationPermission(desktopNotificationPermissionGlobalState);
        }
    }, [isDesktop, isSupported, requestDesktopNotificationPermission]);

    return [desktopNotificationPermission, requestDesktopNotificationPermission];
}
