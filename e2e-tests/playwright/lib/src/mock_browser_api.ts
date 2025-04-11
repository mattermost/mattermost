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
 * `stubNotification` intercepts the Notification API to capture notifications.
 *
 * Note:
 * - Works across browsers and devices, except in headless mode, where stubbing the Notification API is supported only in Firefox and WebKit.
 * - An `Error: page.evaluate: window.getNotifications is not a function` may occur if the `stubNotification` function is called before the page has fully loaded.
 *
 * @param page Page object
 * @param permission Permission setting for notifications, with possible values: "default" | "granted" | "denied". Note: A notification sound may still occur even when set to "denied", as the browser might attempt to trigger system notifications.
 */
export async function stubNotification(page: Page, permission: NotificationPermission) {
    await page.evaluate((notificationPermission: NotificationPermission) => {
        // Override the Notification.requestPermission method
        window.Notification.requestPermission = () => Promise.resolve(permission);

        // Copy the original Notification
        if (!window._originalNotification) {
            window._originalNotification = window.Notification;
        }

        // Initialize a list where to capture the notifications
        window._notifications = [];

        // Override the Notification constructor
        class CustomNotification extends window._originalNotification {
            constructor(title: string, options?: NotificationOptions) {
                super(title, options);
                const notification = {title, ...options};
                window._notifications.push(notification);
            }
        }

        // Set static properties and permission status
        Object.defineProperties(CustomNotification, {
            permission: {
                get: () => notificationPermission,
            },
            requestPermission: {
                value: () => Promise.resolve(notificationPermission),
            },
        });

        // Replace the global Notification with the custom one
        window.Notification = CustomNotification as unknown as typeof Notification;

        // Method to get all notifications
        window.getNotifications = () => window._notifications;
    }, permission);
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
