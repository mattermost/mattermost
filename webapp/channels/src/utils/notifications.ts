// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import icon50 from 'images/icon50x50.png';
import iconWS from 'images/icon_WS.png';
import * as UserAgent from 'utils/user_agent';

import type {ThunkActionFunc} from 'types/store';

export type NotificationResult = {
    status: 'error' | 'not_sent' | 'success' | 'unsupported';
    reason?: string;
    data?: string;
}

let requestedNotificationPermission = Boolean('Notification' in window && Notification.permission !== 'default');

// showNotification displays a platform notification with the configured parameters.
//
// If successful in showing a notification, it resolves with a callback to manually close the
// notification. If no error occurred but the user did not grant permission to show notifications, it
// resolves with a no-op callback. Not all platforms support all features, and may
// choose different semantics for the notifications.

export interface ShowNotificationParams {
    title: string;
    body: string;
    requireInteraction: boolean;
    silent: boolean;
    onClick?: (this: Notification, e: Event) => any | null;
}

export function showNotification(
    {
        title,
        body,
        requireInteraction,
        silent,
        onClick,
    }: ShowNotificationParams = {
        title: '',
        body: '',
        requireInteraction: false,
        silent: false,
    },
): ThunkActionFunc<Promise<NotificationResult & {callback: () => void}>> {
    return async () => {
        let icon = icon50;
        if (UserAgent.isEdge()) {
            icon = iconWS;
        }

        if (!isNotificationAPISupported()) {
            throw new Error('Notification API is not supported');
        }

        if (Notification.permission !== 'granted') {
            if (requestedNotificationPermission) {
                // User didn't allow notifications
                return {status: 'not_sent', reason: 'notifications_permission_previously_denied', data: Notification.permission, callback: () => {}};
            }

            requestedNotificationPermission = true;

            let permission = await Notification.requestPermission();
            if (typeof permission === 'undefined') {
                // Handle browsers that don't support the promise-based syntax.
                permission = await new Promise((resolve) => {
                    Notification.requestPermission(resolve);
                });
            }

            if (permission !== 'granted') {
                // User has denied notification for the site
                return {status: 'not_sent', reason: 'notifications_permission_denied', data: permission, callback: () => {}};
            }
        }

        const notification = new Notification(title, {
            body,
            tag: body,
            icon,
            requireInteraction,
            silent,
        });

        if (onClick) {
            notification.onclick = onClick;
        }

        notification.onerror = () => {
            throw new Error('Notification failed to show.');
        };

        return {
            status: 'success',
            callback: () => {
                notification.close();
            },
        };
    };
}

export function isNotificationAPISupported() {
    return ('Notification' in window) && (typeof Notification.requestPermission === 'function');
}

export function getNotificationPermission(): NotificationPermission | null {
    if (!isNotificationAPISupported()) {
        return null;
    }

    return Notification.permission;
}

export async function requestNotificationPermission(): Promise<NotificationPermission | null> {
    if (!isNotificationAPISupported()) {
        return null;
    }

    try {
        const notificationPermission = await Notification.requestPermission();
        return notificationPermission;
    } catch (error) {
        return null;
    }
}

export const NotificationPermissionNeverGranted = 'default';
export const NotificationPermissionGranted = 'granted';
export const NotificationPermissionDenied = 'denied';
