// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as Notifications from './notifications';

declare global {
    interface Window {
        Notification: any;
    }
}

describe('Notifications.showNotification', () => {
    const notification = {
        body: 'body',
        requireInteraction: true,
        silent: false,
        title: '',
    };

    test('should throw an exception if Notification is not defined on window', async () => {
        await expect(Notifications.showNotification(notification)).rejects.toThrow('Notification not supported');
    });

    test('should throw an exception if Notification.requestPermission is not defined', async () => {
        window.Notification = {};
        await expect(Notifications.showNotification(notification)).rejects.toThrow('Notification.requestPermission not supported');
    });

    test('should throw an exception if Notification.requestPermission is not a function', async () => {
        window.Notification = {
            requestPermission: true,
        };
        await expect(Notifications.showNotification(notification)).rejects.toThrow('Notification.requestPermission not supported');
    });

    test('should request permissions if not previously requested and then do nothing if denied', async () => {
        window.Notification = jest.fn();
        window.Notification.requestPermission = jest.fn(() => Promise.resolve('denied'));
        window.Notification.permission = 'default';

        await Notifications.showNotification(notification);

        expect(window.Notification.requestPermission).toHaveBeenCalledTimes(1);
        expect(window.Notification).toHaveBeenCalledTimes(0);
    });

    test('should request permissions if not previously requested and then send the notification if allowed', async () => {
        window.Notification = jest.fn();
        window.Notification.requestPermission = jest.fn(() => Promise.resolve('denied'));
        window.Notification.permission = 'default';

        await Notifications.showNotification(notification);

        expect(window.Notification.requestPermission).toHaveBeenCalledTimes(1);
        expect(window.Notification).toHaveBeenCalledTimes(0);
    });

    test('should send notification if previously allowed', async () => {
        window.Notification = jest.fn();
        window.Notification.requestPermission = jest.fn(() => Promise.resolve('denied'));
        window.Notification.permission = 'allowed';

        await Notifications.showNotification(notification);

        expect(window.Notification.requestPermission).toHaveBeenCalledTimes(0);
        expect(window.Notification).toHaveBeenCalledTimes(1);
    });

    test('should do nothing if previously denied', async () => {
        window.Notification = jest.fn();
        window.Notification.requestPermission = jest.fn(() => Promise.resolve('denied'));
        window.Notification.permission = 'denied';

        await Notifications.showNotification(notification);

        expect(window.Notification.requestPermission).toHaveBeenCalledTimes(0);
        expect(window.Notification).toHaveBeenCalledTimes(0);
    });
});
