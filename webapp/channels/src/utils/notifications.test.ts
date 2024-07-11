// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable global-require */

// to enable being a typescript file
export const a = '';
import configureStore from 'tests/test_store';

import type {showNotification} from './notifications';

declare global {
    interface Window {
        Notification: any;
    }
}

describe('Notifications.showNotification', () => {
    let Notifications: {showNotification: typeof showNotification};

    let store: ReturnType<typeof configureStore>;

    beforeEach(() => {
        // Re-import utils/notifications for every test to reset requestedNotificationPermission
        jest.resetModules();
        Notifications = require('utils/notifications');

        store = configureStore();
    });

    it('should throw an exception if Notification is not defined on window', async () => {
        delete window.Notification;

        await expect(store.dispatch(Notifications.showNotification())).rejects.toThrow('Notification not supported');
    });

    it('should throw an exception if Notification.requestPermission is not defined', async () => {
        window.Notification = jest.fn();

        await expect(store.dispatch(Notifications.showNotification())).rejects.toThrow('Notification.requestPermission not supported');
    });

    it('should throw an exception if Notification.requestPermission is not a function', async () => {
        window.Notification = jest.fn();
        window.Notification.requestPermission = true;

        await expect(store.dispatch(Notifications.showNotification())).rejects.toThrow('Notification.requestPermission not supported');
        expect(window.Notification).not.toHaveBeenCalled();
    });

    it('should request permissions, promise style, if not previously requested and do nothing when permission is denied', async () => {
        window.Notification = jest.fn();
        window.Notification.requestPermission = () => Promise.resolve('denied');
        window.Notification.permission = 'default';

        await expect(store.dispatch(Notifications.showNotification())).resolves.toMatchObject({
            status: 'not_sent',
            reason: 'notifications_permission_denied',
        });
        expect(window.Notification).not.toHaveBeenCalled();
    });

    it('should request permissions, callback style, if not previously requested and do nothing when permission is denied', async () => {
        window.Notification = jest.fn();
        window.Notification.requestPermission = (callback: NotificationPermissionCallback) => {
            if (callback) {
                callback('denied');
            }
        };
        window.Notification.permission = 'default';

        await expect(store.dispatch(Notifications.showNotification())).resolves.toMatchObject({
            status: 'not_sent',
            reason: 'notifications_permission_denied',
        });
        expect(window.Notification).not.toHaveBeenCalled();
    });

    it('should request permissions, promise style, if not previously requested and show notification when permission is granted', async () => {
        window.Notification = jest.fn();
        window.Notification.requestPermission = () => Promise.resolve('granted');
        window.Notification.permission = 'denied';

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
        window.Notification = jest.fn();
        window.Notification.requestPermission = (callback: NotificationPermissionCallback) => {
            if (callback) {
                callback('granted');
            }
        };
        window.Notification.permission = 'denied';

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

    it('should do nothing if permissions previously requested but not granted', async () => {
        window.Notification = jest.fn();
        window.Notification.requestPermission = () => Promise.resolve('denied');
        window.Notification.permission = 'denied';

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
        window.Notification = jest.fn();
        window.Notification.requestPermission = jest.fn().mockResolvedValueOnce('granted');
        window.Notification.permission = 'default';

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
        window.Notification = jest.fn();
        window.Notification.requestPermission = jest.fn().mockResolvedValueOnce('denied');
        window.Notification.permission = 'default';

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
        window.Notification = jest.fn();
        window.Notification.requestPermission = jest.fn().mockResolvedValueOnce('default');
        window.Notification.permission = 'default';

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
});
