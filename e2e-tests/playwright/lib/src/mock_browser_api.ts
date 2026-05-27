// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Page} from '@playwright/test';

type NotificationData = {title: string} & NotificationOptions;

// Extend the Window interface to add custom properties
declare global {
    interface Window {
        _originalNotification: typeof Notification;
        _notifications: NotificationData[];
        getNotifications: () => NotificationData[];
    }
}

/**
 * Installed in the browser via addInitScript and page.evaluate. Must be
 * self-contained (no closure over module scope) so Playwright can serialize it.
 */
function installNotificationStub(notificationPermission: NotificationPermission) {
    window.Notification.requestPermission = () => Promise.resolve(notificationPermission);

    if (!window._originalNotification) {
        window._originalNotification = window.Notification;
    }

    window._notifications = window._notifications ?? [];

    class CustomNotification extends window._originalNotification {
        constructor(title: string, options?: NotificationOptions) {
            super(title, options);
            const notification = {title, ...options};
            window._notifications.push(notification);
        }
    }

    Object.defineProperties(CustomNotification, {
        permission: {
            get: () => notificationPermission,
        },
        requestPermission: {
            value: () => Promise.resolve(notificationPermission),
        },
    });

    window.Notification = CustomNotification as unknown as typeof Notification;
    window.getNotifications = () => window._notifications;
}

/**
 * `stubNotification` intercepts the Notification API to capture notifications.
 *
 * Note:
 * - Works across browsers and devices, except in headless mode, where stubbing the Notification API is supported only in Firefox and WebKit.
 * - Uses addInitScript so the stub survives channel navigations after login without clearing captured notifications.
 *
 * @param page Page object
 * @param permission Permission setting for notifications, with possible values: "default" | "granted" | "denied". Note: A notification sound may still occur even when set to "denied", as the browser might attempt to trigger system notifications.
 */
export async function stubNotification(page: Page, permission: NotificationPermission) {
    await page.addInitScript(installNotificationStub, permission);
    await page.evaluate(installNotificationStub, permission);
}

/** Clears notifications captured by {@link stubNotification}. */
export async function clearCapturedNotifications(page: Page) {
    await page.evaluate(() => {
        window._notifications = [];
    });
}

/**
 * `waitForNotification` waits for a specified number of notifications to be received on the page within a given timeout.
 * @param page Page object
 * @param expectedCount Number of notifications to wait for before returning. (default: 1)
 * @param timeout Wait time in milliseconds. (default: 5000ms)
 * @returns An array of notifications received
 */
export async function waitForNotification(
    page: Page,
    expectedCount = 1,
    timeout: number = 5000,
): Promise<NotificationData[]> {
    const start = Date.now();
    while (Date.now() - start < timeout) {
        const notifications = await page.evaluate(() => window.getNotifications());
        if (notifications.length >= expectedCount) {
            return notifications;
        }
        await new Promise((resolve) => setTimeout(resolve, 100));
    }
    // eslint-disable-next-line no-console
    console.error(`Notification not received within the timeout period of ${timeout}ms`);
    return [];
}
