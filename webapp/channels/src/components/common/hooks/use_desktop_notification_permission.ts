// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {type NotificationPermissionNeverGranted} from 'utils/notifications';
import {isNotificationAPISupported} from 'utils/notifications';
import {isDesktopApp} from 'utils/user_agent';

export type DesktopNotificationPermission = Exclude<NotificationPermission, typeof NotificationPermissionNeverGranted> | undefined;

// We store the permission state here to avoid calling requestPermission() multiple times
let desktopNotificationPermissionState: DesktopNotificationPermission | undefined;

// This is used to request notification permission for desktop app
// it also returns the permission state. We use this as a workaround for bug with Electron - https://github.com/electron/electron/issues/11221
// tl;dr Electron always show 'granted' when queries for Notification.permission, hence this workaround
export async function getDesktopAppNotificationPermission(): Promise<DesktopNotificationPermission> {
    if (!isDesktopApp()) {
        return undefined;
    }

    if (!isNotificationAPISupported()) {
        return undefined;
    }

    // When we don't have the permission state, we need to request it
    if (desktopNotificationPermissionState === undefined) {
        // Based on Electron's notification permission it will have following states
        // - allowed - No further action needed
        // - denied permanently - No further action needed
        // - denied (temporary) - In this case, electron notification permission dialog is shown with requestPermission()
        const permission = await Notification.requestPermission();
        desktopNotificationPermissionState = permission as DesktopNotificationPermission;
        return desktopNotificationPermissionState;
    }

    return desktopNotificationPermissionState;
}
