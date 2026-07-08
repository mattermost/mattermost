// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Page} from '@playwright/test';

type NotificationData = {title: string} & NotificationOptions;

type MockWebSocket = {
    wrappedSocket: WebSocket | null;
    onopen: ((ev: Event) => void) | null;
    onmessage: ((ev: MessageEvent) => void) | null;
    onerror: ((ev: Event) => void) | null;
    onclose: ((ev: CloseEvent) => void) | null;
    readyState: number;
    send(data: string | ArrayBuffer): void;
    close(): void;
    connect(): void;
};

// Extend the Window interface to add custom properties
declare global {
    interface Window {
        originalNotification: typeof Notification;
        capturedNotifications: NotificationData[];
        getNotifications: () => NotificationData[];
        mockWebsockets: MockWebSocket[];
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
        if (!window.originalNotification) {
            window.originalNotification = window.Notification;
        }

        // Initialize a list where to capture the notifications
        window.capturedNotifications = [];

        // Override the Notification constructor
        class CustomNotification extends window.originalNotification {
            constructor(title: string, options?: NotificationOptions) {
                super(title, options);
                const notification = {title, ...options};
                window.capturedNotifications.push(notification);
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
        window.getNotifications = () => window.capturedNotifications;
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

/**
 * `mockWebsockets` wraps `window.WebSocket` so the test can close and reopen the underlying
 * socket connection(s) on demand, to simulate a socket disconnect/reconnect without navigating
 * away from the page. Mocked sockets do not auto-connect on construction — call
 * `connectWebsockets` to open them.
 *
 * Must be called on a `page` that has not yet navigated (e.g. right after `pw.testBrowser.login()`,
 * before `channelsPage.goto(...)`), since it installs the override via `addInitScript` so it's in
 * place before the app's own bundle constructs its WebSocket client.
 *
 * @param page Page object, not yet navigated
 */
export async function mockWebsockets(page: Page) {
    await page.addInitScript(() => {
        const RealWebSocket = window.WebSocket;
        window.mockWebsockets = [];

        class MockWebSocketImpl {
            // Match the standard WebSocket.readyState values so client code comparing
            // against `WebSocket.OPEN` (now this class, since it replaces window.WebSocket)
            // sees real state transitions instead of coincidental `undefined === undefined`.
            static readonly CONNECTING = 0;
            static readonly OPEN = 1;
            static readonly CLOSING = 2;
            static readonly CLOSED = 3;

            wrappedSocket: WebSocket | null = null;
            onopen: ((ev: Event) => void) | null = null;
            onmessage: ((ev: MessageEvent) => void) | null = null;
            onerror: ((ev: Event) => void) | null = null;
            onclose: ((ev: CloseEvent) => void) | null = null;
            readyState: number = MockWebSocketImpl.CONNECTING;
            private readonly args: [string | URL, (string | string[])?];

            constructor(...args: [string | URL, (string | string[])?]) {
                this.args = args;
                window.mockWebsockets.push(this);
            }

            send(data: string | ArrayBuffer) {
                if (this.wrappedSocket) {
                    this.wrappedSocket.send(data);
                } else if (this.onerror) {
                    this.onerror(new Event('error'));
                }
            }

            close() {
                if (this.wrappedSocket) {
                    this.readyState = MockWebSocketImpl.CLOSING;
                    this.wrappedSocket.close(1000);
                } else {
                    this.readyState = MockWebSocketImpl.CLOSED;
                }
            }

            connect() {
                const socket = new RealWebSocket(...this.args);
                this.readyState = MockWebSocketImpl.CONNECTING;
                socket.onopen = (ev) => {
                    this.readyState = MockWebSocketImpl.OPEN;
                    this.onopen?.(ev);
                };
                socket.onmessage = (ev) => this.onmessage?.(ev);
                socket.onerror = (ev) => this.onerror?.(ev);
                socket.onclose = (ev) => {
                    this.readyState = MockWebSocketImpl.CLOSED;
                    this.onclose?.(ev);
                };
                this.wrappedSocket = socket;
            }
        }

        window.WebSocket = MockWebSocketImpl as unknown as typeof WebSocket;
    });
}

/**
 * Opens (or reopens) every mocked WebSocket tracked by `mockWebsockets`, simulating a reconnect.
 * @param page Page object
 */
export async function connectWebsockets(page: Page) {
    await page.evaluate(() => {
        window.mockWebsockets.forEach((ws) => ws.connect());
    });
}

/**
 * Closes every mocked WebSocket tracked by `mockWebsockets`, simulating a disconnect.
 * @param page Page object
 */
export async function closeWebsockets(page: Page) {
    await page.evaluate(() => {
        window.mockWebsockets.forEach((ws) => ws.close());
    });
}
