// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable global-require */

import configureStore from 'tests/test_store';

import type {showNotification} from './notifications';
import {isNotificationAPISupported, requestNotificationPermission} from './notifications';

declare global {
    interface Window {
        Notification: any;
    }
}

describe('Notifications.showNotification', () => {
    let Notifications: {showNotification: typeof showNotification};

    let store: ReturnType<typeof configureStore>;

    beforeEach(() => {
        // Re-initialize window.Notification so that tests can modify it as needed. By default, everything exists,
        // we've never requested permissions before, and any request for permissions will be denied.
        window.Notification = jest.fn(() => ({
            close: jest.fn(),
        }));
        window.Notification.requestPermission = jest.fn(() => Promise.resolve('denied'));
        window.Notification.permission = 'default';

        // Reset and re-import utils/notifications for every test to reset requestedNotificationPermission
        jest.resetModules();
        Notifications = require('utils/notifications');

        store = configureStore();
    });

    it('should throw an exception if Notification is not defined on window', async () => {
        delete window.Notification;

        await expect(store.dispatch(Notifications.showNotification())).rejects.toThrow('Notification API is not supported');
    });

    it('should throw an exception if Notification.requestPermission is not defined', async () => {
        window.Notification = jest.fn();

        await expect(store.dispatch(Notifications.showNotification())).rejects.toThrow('Notification API is not supported');
    });

    it('should throw an exception if Notification.requestPermission is not a function', async () => {
        window.Notification = jest.fn();
        window.Notification.requestPermission = true;

        await expect(store.dispatch(Notifications.showNotification())).rejects.toThrow('Notification API is not supported');
        expect(window.Notification).not.toHaveBeenCalled();
    });

    it('should request permissions, promise style, if not previously requested and not show a notification when permission is denied', async () => {
        window.Notification.requestPermission.mockResolvedValue('denied');

        await expect(store.dispatch(Notifications.showNotification())).resolves.toMatchObject({
            status: 'not_sent',
            reason: 'notifications_permission_denied',
        });
        expect(window.Notification).not.toHaveBeenCalled();
    });

    it('should request permissions, callback style, if not previously requested and not show a notification when permission is denied', async () => {
        window.Notification.requestPermission = (callback: NotificationPermissionCallback) => callback?.('denied');

        await expect(store.dispatch(Notifications.showNotification())).resolves.toMatchObject({
            status: 'not_sent',
            reason: 'notifications_permission_denied',
        });
        expect(window.Notification).not.toHaveBeenCalled();
    });

    it('should request permissions, promise style, if not previously requested and show notification when permission is granted', async () => {
        window.Notification.requestPermission.mockResolvedValue('granted');

        const n = {};
        window.Notification.mockReturnValueOnce(n);

        await expect(store.dispatch(Notifications.showNotification({
            body: 'body',
            requireInteraction: true,
            silent: false,
            title: '',
        }))).resolves.toMatchObject({
            status: 'success',
        });
        expect(window.Notification.mock.calls.length).toBe(1);
        const call = window.Notification.mock.calls[0];
        expect(call[1]).toEqual({
            body: 'body',
            tag: 'body',
            icon: '',
            requireInteraction: true,
            silent: false,
        });
    });

    it('should request permissions, callback style, if not previously requested and show notification when permission is granted', async () => {
        window.Notification.requestPermission = (callback: NotificationPermissionCallback) => {
            if (callback) {
                callback('granted');
            }
        };

        await expect(store.dispatch(Notifications.showNotification({
            body: 'body',
            requireInteraction: true,
            silent: false,
            title: '',
        }))).resolves.toMatchObject({
            status: 'success',
        });
        expect(window.Notification.mock.calls.length).toBe(1);
        const call = window.Notification.mock.calls[0];
        expect(call[1]).toEqual({
            body: 'body',
            tag: 'body',
            icon: '',
            requireInteraction: true,
            silent: false,
        });
    });

    it('should do nothing if permissions previously requested but not granted', async () => {
        window.Notification.requestPermission.mockResolvedValue('denied');

        // Call one to deny and mark as already requested, do nothing, throw nothing
        await expect(store.dispatch(Notifications.showNotification())).resolves.toMatchObject({
            status: 'not_sent',
            reason: 'notifications_permission_denied',
        });

        // Try again
        await expect(store.dispatch(Notifications.showNotification())).resolves.toMatchObject({
            status: 'not_sent',
            reason: 'notifications_permission_previously_denied',
        });
    });

    it('should only request permissions once if permissions are granted in response to that request', async () => {
        window.Notification.requestPermission.mockResolvedValue('granted');

        await expect(store.dispatch(Notifications.showNotification())).resolves.toMatchObject({
            status: 'success',
        });
        expect(window.Notification).toHaveBeenCalledTimes(1);
        expect(window.Notification.requestPermission).toHaveBeenCalledTimes(1);

        window.Notification.permission = 'granted';

        await expect(store.dispatch(Notifications.showNotification())).resolves.toMatchObject({
            status: 'success',
        });
        expect(window.Notification).toHaveBeenCalledTimes(2);
        expect(window.Notification.requestPermission).toHaveBeenCalledTimes(1);
    });

    it('should only request permissions once if request gets denied', async () => {
        window.Notification.requestPermission.mockResolvedValue('denied');

        await expect(store.dispatch(Notifications.showNotification())).resolves.toMatchObject({
            status: 'not_sent',
            reason: 'notifications_permission_denied',
        });
        expect(window.Notification).toHaveBeenCalledTimes(0);
        expect(window.Notification.requestPermission).toHaveBeenCalledTimes(1);

        window.Notification.permission = 'denied';

        await expect(store.dispatch(Notifications.showNotification())).resolves.toMatchObject({
            status: 'not_sent',
            reason: 'notifications_permission_previously_denied',
        });
        expect(window.Notification).toHaveBeenCalledTimes(0);
        expect(window.Notification.requestPermission).toHaveBeenCalledTimes(1);
    });

    it('should only request permissions once if request gets ignored', async () => {
        window.Notification.requestPermission.mockResolvedValue('default');

        await expect(store.dispatch(Notifications.showNotification())).resolves.toMatchObject({
            status: 'not_sent',
            reason: 'notifications_permission_denied',
        });
        expect(window.Notification).toHaveBeenCalledTimes(0);
        expect(window.Notification.requestPermission).toHaveBeenCalledTimes(1);

        await expect(store.dispatch(Notifications.showNotification())).resolves.toMatchObject({
            status: 'not_sent',
            reason: 'notifications_permission_previously_denied',
        });
        expect(window.Notification).toHaveBeenCalledTimes(0);
        expect(window.Notification.requestPermission).toHaveBeenCalledTimes(1);
    });

    it('should not request permission if it was granted during a previous session', async () => {
        window.Notification.permission = 'granted';

        // Reload utils/notifications to set requestedNotificationPermission to true based on Notification.permission
        jest.resetModules();
        Notifications = require('utils/notifications');

        await expect(store.dispatch(Notifications.showNotification())).resolves.toMatchObject({
            status: 'success',
        });
        expect(window.Notification).toHaveBeenCalledTimes(1);
        expect(window.Notification.requestPermission).toHaveBeenCalledTimes(0);

        await expect(store.dispatch(Notifications.showNotification())).resolves.toMatchObject({
            status: 'success',
        });
        expect(window.Notification).toHaveBeenCalledTimes(2);
        expect(window.Notification.requestPermission).toHaveBeenCalledTimes(0);
    });

    it('should not request permission if it was denied during a previous session', async () => {
        window.Notification.permission = 'denied';

        // Reload utils/notifications to set requestedNotificationPermission to true based on Notification.permission
        jest.resetModules();
        Notifications = require('utils/notifications');

        await expect(store.dispatch(Notifications.showNotification())).resolves.toMatchObject({
            status: 'not_sent',
            reason: 'notifications_permission_previously_denied',
        });
        expect(window.Notification).toHaveBeenCalledTimes(0);
        expect(window.Notification.requestPermission).toHaveBeenCalledTimes(0);

        await expect(store.dispatch(Notifications.showNotification())).resolves.toMatchObject({
            status: 'not_sent',
            reason: 'notifications_permission_previously_denied',
        });
        expect(window.Notification).toHaveBeenCalledTimes(0);
        expect(window.Notification.requestPermission).toHaveBeenCalledTimes(0);
    });
});

describe('Notifications.isNotificationAPISupported', () => {
    beforeEach(() => {
        window.Notification = {
            requestPermission: jest.fn(),
        };
    });

    afterEach(() => {
        delete (window as any).Notification;
    });

    it('should return true if Notification is supported', () => {
        expect(isNotificationAPISupported()).toBe(true);
    });

    it('should return false if Notification is not supported', () => {
        delete (window as any).Notification;

        expect(isNotificationAPISupported()).toBe(false);
    });

    it('should return false if requestPermission is not a function', () => {
        (window as any).Notification = {};

        expect(isNotificationAPISupported()).toBe(false);
    });
});

describe('Notifications.requestNotificationPermission', () => {
    beforeEach(() => {
        (window as any).Notification = {
            requestPermission: jest.fn(),
        };
    });

    afterEach(() => {
        delete (window as any).Notification;
    });

    it('should return the permission if Notification.requestPermission resolves', async () => {
        (window as any).Notification.requestPermission = jest.fn().mockResolvedValue('granted');

        const permission = await requestNotificationPermission();
        expect(permission).toBe('granted');
    });

    it('should return null if Notification is not supported', async () => {
        delete (window as any).Notification;

        const permission = await requestNotificationPermission();
        expect(permission).toBeNull();
    });

    it('should return null if requestPermission throws an error', async () => {
        (window as any).Notification.requestPermission = jest.fn().mockRejectedValue('some error');

        const permission = await requestNotificationPermission();
        expect(permission).toBeNull();
    });
});
