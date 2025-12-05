// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import configureStore from 'tests/test_store';

declare global {
    interface Window {
        Notification: any;
    }
}

// Create a mock Notification class that can be used as a constructor
// eslint-disable-next-line func-names
function createNotificationMock() {
    // Using regular function syntax (not arrow) is required for constructor mocks
    // eslint-disable-next-line func-names
    const MockNotification = vi.fn(function MockNotificationImpl(this: any) {
        this.close = vi.fn();
    }) as any;
    // eslint-disable-next-line func-names, prefer-arrow-callback
    MockNotification.requestPermission = vi.fn(function requestPermissionImpl() {
        return Promise.resolve('denied');
    });
    MockNotification.permission = 'default';
    return MockNotification;
}

// Stub Notification globally before any module code runs
// This is necessary because notifications.ts has module-level code that accesses Notification.permission
vi.stubGlobal('Notification', createNotificationMock());

describe('Notifications.showNotification', () => {
    let Notifications: typeof import('./notifications');
    let store: ReturnType<typeof configureStore>;

    beforeEach(async () => {
        // Clean up any previous stubs first
        vi.unstubAllGlobals();

        // Re-initialize Notification so that tests can modify it as needed
        vi.stubGlobal('Notification', createNotificationMock());

        // Reset and re-import utils/notifications for every test to reset requestedNotificationPermission
        vi.resetModules();
        Notifications = await import('utils/notifications');

        store = configureStore();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should throw an exception if Notification is not defined on window', async () => {
        vi.unstubAllGlobals();

        await expect(store.dispatch(Notifications.showNotification())).rejects.toThrow('Notification API is not supported');
    });

    it('should throw an exception if Notification.requestPermission is not defined', async () => {
        vi.stubGlobal('Notification', vi.fn());

        await expect(store.dispatch(Notifications.showNotification())).rejects.toThrow('Notification API is not supported');
    });

    it('should throw an exception if Notification.requestPermission is not a function', async () => {
        vi.stubGlobal('Notification', vi.fn());
        (globalThis as any).Notification.requestPermission = true;

        await expect(store.dispatch(Notifications.showNotification())).rejects.toThrow('Notification API is not supported');
        expect((globalThis as any).Notification).not.toHaveBeenCalled();
    });

    it('should request permissions, promise style, if not previously requested and not show a notification when permission is denied', async () => {
        (globalThis as any).Notification.requestPermission.mockResolvedValue('denied');

        await expect(store.dispatch(Notifications.showNotification())).resolves.toMatchObject({
            status: 'not_sent',
            reason: 'notifications_permission_denied',
        });
        expect((globalThis as any).Notification).not.toHaveBeenCalled();
    });

    it('should request permissions, callback style, if not previously requested and not show a notification when permission is denied', async () => {
        (globalThis as any).Notification.requestPermission = (callback: NotificationPermissionCallback) => callback?.('denied');

        await expect(store.dispatch(Notifications.showNotification())).resolves.toMatchObject({
            status: 'not_sent',
            reason: 'notifications_permission_denied',
        });
        expect((globalThis as any).Notification).not.toHaveBeenCalled();
    });

    it('should request permissions, promise style, if not previously requested and show notification when permission is granted', async () => {
        (globalThis as any).Notification.requestPermission.mockResolvedValue('granted');

        await expect(store.dispatch(Notifications.showNotification({
            body: 'body',
            requireInteraction: true,
            silent: false,
            title: '',
        }))).resolves.toMatchObject({
            status: 'success',
        });
        expect((globalThis as any).Notification.mock.calls.length).toBe(1);
        const call = (globalThis as any).Notification.mock.calls[0];
        expect(call[1]).toMatchObject({
            body: 'body',
            tag: 'body',
            requireInteraction: true,
            silent: false,
        });
    });

    it('should request permissions, callback style, if not previously requested and show notification when permission is granted', async () => {
        (globalThis as any).Notification.requestPermission = (callback: NotificationPermissionCallback) => {
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
        expect((globalThis as any).Notification.mock.calls.length).toBe(1);
        const call = (globalThis as any).Notification.mock.calls[0];
        expect(call[1]).toMatchObject({
            body: 'body',
            tag: 'body',
            requireInteraction: true,
            silent: false,
        });
    });

    it('should do nothing if permissions previously requested but not granted', async () => {
        (globalThis as any).Notification.requestPermission.mockResolvedValue('denied');

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
        (globalThis as any).Notification.requestPermission.mockResolvedValue('granted');

        await expect(store.dispatch(Notifications.showNotification())).resolves.toMatchObject({
            status: 'success',
        });
        expect((globalThis as any).Notification).toHaveBeenCalledTimes(1);
        expect((globalThis as any).Notification.requestPermission).toHaveBeenCalledTimes(1);

        (globalThis as any).Notification.permission = 'granted';

        await expect(store.dispatch(Notifications.showNotification())).resolves.toMatchObject({
            status: 'success',
        });
        expect((globalThis as any).Notification).toHaveBeenCalledTimes(2);
        expect((globalThis as any).Notification.requestPermission).toHaveBeenCalledTimes(1);
    });

    it('should only request permissions once if request gets denied', async () => {
        (globalThis as any).Notification.requestPermission.mockResolvedValue('denied');

        await expect(store.dispatch(Notifications.showNotification())).resolves.toMatchObject({
            status: 'not_sent',
            reason: 'notifications_permission_denied',
        });
        expect((globalThis as any).Notification).toHaveBeenCalledTimes(0);
        expect((globalThis as any).Notification.requestPermission).toHaveBeenCalledTimes(1);

        (globalThis as any).Notification.permission = 'denied';

        await expect(store.dispatch(Notifications.showNotification())).resolves.toMatchObject({
            status: 'not_sent',
            reason: 'notifications_permission_previously_denied',
        });
        expect((globalThis as any).Notification).toHaveBeenCalledTimes(0);
        expect((globalThis as any).Notification.requestPermission).toHaveBeenCalledTimes(1);
    });

    it('should only request permissions once if request gets ignored', async () => {
        (globalThis as any).Notification.requestPermission.mockResolvedValue('default');

        await expect(store.dispatch(Notifications.showNotification())).resolves.toMatchObject({
            status: 'not_sent',
            reason: 'notifications_permission_denied',
        });
        expect((globalThis as any).Notification).toHaveBeenCalledTimes(0);
        expect((globalThis as any).Notification.requestPermission).toHaveBeenCalledTimes(1);

        await expect(store.dispatch(Notifications.showNotification())).resolves.toMatchObject({
            status: 'not_sent',
            reason: 'notifications_permission_previously_denied',
        });
        expect((globalThis as any).Notification).toHaveBeenCalledTimes(0);
        expect((globalThis as any).Notification.requestPermission).toHaveBeenCalledTimes(1);
    });

    it('should not request permission if it was granted during a previous session', async () => {
        (globalThis as any).Notification.permission = 'granted';

        // Reload utils/notifications to set requestedNotificationPermission to true based on Notification.permission
        vi.resetModules();
        Notifications = await import('utils/notifications');

        await expect(store.dispatch(Notifications.showNotification())).resolves.toMatchObject({
            status: 'success',
        });
        expect((globalThis as any).Notification).toHaveBeenCalledTimes(1);
        expect((globalThis as any).Notification.requestPermission).toHaveBeenCalledTimes(0);

        await expect(store.dispatch(Notifications.showNotification())).resolves.toMatchObject({
            status: 'success',
        });
        expect((globalThis as any).Notification).toHaveBeenCalledTimes(2);
        expect((globalThis as any).Notification.requestPermission).toHaveBeenCalledTimes(0);
    });

    it('should not request permission if it was denied during a previous session', async () => {
        (globalThis as any).Notification.permission = 'denied';

        // Reload utils/notifications to set requestedNotificationPermission to true based on Notification.permission
        vi.resetModules();
        Notifications = await import('utils/notifications');

        await expect(store.dispatch(Notifications.showNotification())).resolves.toMatchObject({
            status: 'not_sent',
            reason: 'notifications_permission_previously_denied',
        });
        expect((globalThis as any).Notification).toHaveBeenCalledTimes(0);
        expect((globalThis as any).Notification.requestPermission).toHaveBeenCalledTimes(0);

        await expect(store.dispatch(Notifications.showNotification())).resolves.toMatchObject({
            status: 'not_sent',
            reason: 'notifications_permission_previously_denied',
        });
        expect((globalThis as any).Notification).toHaveBeenCalledTimes(0);
        expect((globalThis as any).Notification.requestPermission).toHaveBeenCalledTimes(0);
    });
});

describe('Notifications.isNotificationAPISupported', () => {
    let isNotificationAPISupported: typeof import('./notifications').isNotificationAPISupported;

    beforeEach(async () => {
        vi.stubGlobal('Notification', {
            requestPermission: vi.fn(),
            permission: 'default',
        });
        vi.resetModules();
        const module = await import('utils/notifications');
        isNotificationAPISupported = module.isNotificationAPISupported;
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('should return true if Notification is supported', () => {
        expect(isNotificationAPISupported()).toBe(true);
    });

    it('should return false if Notification is not supported', () => {
        vi.unstubAllGlobals();

        expect(isNotificationAPISupported()).toBe(false);
    });

    it('should return false if requestPermission is not a function', () => {
        vi.stubGlobal('Notification', {});

        expect(isNotificationAPISupported()).toBe(false);
    });
});

describe('Notifications.requestNotificationPermission', () => {
    let requestNotificationPermission: typeof import('./notifications').requestNotificationPermission;

    beforeEach(async () => {
        vi.stubGlobal('Notification', {
            requestPermission: vi.fn(),
            permission: 'default',
        });
        vi.resetModules();
        const module = await import('utils/notifications');
        requestNotificationPermission = module.requestNotificationPermission;
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('should return the permission if Notification.requestPermission resolves', async () => {
        (globalThis as any).Notification.requestPermission = vi.fn().mockResolvedValue('granted');

        const permission = await requestNotificationPermission();
        expect(permission).toBe('granted');
    });

    it('should return null if Notification is not supported', async () => {
        vi.unstubAllGlobals();

        const permission = await requestNotificationPermission();
        expect(permission).toBeNull();
    });

    it('should return null if requestPermission throws an error', async () => {
        (globalThis as any).Notification.requestPermission = vi.fn().mockRejectedValue('some error');

        const permission = await requestNotificationPermission();
        expect(permission).toBeNull();
    });
});
