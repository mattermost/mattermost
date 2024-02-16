// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {DispatchFunc} from 'mattermost-redux/types/actions';

import {requestNotificationPermission} from 'actions/notification_actions';

import icon50 from 'images/icon50x50.png';
import iconWS from 'images/icon_WS.png';
import Constants from 'utils/constants';
import * as UserAgent from 'utils/user_agent';

// showNotification displays a platform notification with the configured parameters.
//
// If successful in showing a notification, it resolves with a callback to manually close the
// notification. If no error occurred but the user did not grant permission to show notifications, it
// resolves with a no-op callback. Notifications that do not require interaction will be closed automatically after
// the Constants.DEFAULT_NOTIFICATION_DURATION. Not all platforms support all features, and may
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
    }: ShowNotificationParams,
) {
    return async (dispatch: DispatchFunc) => {
        let icon = icon50;
        if (UserAgent.isEdge()) {
            icon = iconWS;
        }

        let permission = Notification.permission;
        console.log('NOTIFCIATION', 'initial permission', permission);
        if (Notification.permission === 'default' && window.isActive) {
            console.log('NOTIFCIATION', 'prompting for permission');
            permission = await Notification.requestPermission();
            console.log('NOTIFCIATION', 'request returned', permission);
        }

        if (permission === 'denied') {
            // User didn't allow notifications
            console.log('NOTIFCIATION', 'permissions denied');
            return () => {};
        } else if (permission === 'default') {
            console.log('NOTIFCIATION', 'showing notification bar');

            // Firefox and Edge doesn't let us prompt to allow notifications except in response to user interaction,
            // so ask for permission the next time they click into the app
            dispatch(requestNotificationPermission());

            return () => {};
        }

        console.log('NOTIFCIATION', 'sending notification');

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

        // Mac desktop app notification dismissal is handled by the OS
        if (!requireInteraction && !UserAgent.isMacApp()) {
            setTimeout(() => {
                notification.close();
            }, Constants.DEFAULT_NOTIFICATION_DURATION);
        }

        return () => {
            notification.close();
        };
    };
}
