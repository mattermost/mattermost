// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {DesktopNotificationPermission} from 'components/common/hooks/use_desktop_notification_permission';

import {renderWithContext, screen} from 'tests/react_testing_utils';

import NotificationPermissionSectionNotice from './index';

jest.mock('utils/notifications', () => ({
    isNotificationAPISupported: jest.fn(),
    getNotificationPermission: jest.fn(),
    NotificationPermissionNeverGranted: 'default',
    NotificationPermissionGranted: 'granted',
    NotificationPermissionDenied: 'denied',
}));

jest.mock('components/common/hooks/use_desktop_notification_permission', () => ({
    useDesktopAppNotificationPermission: jest.fn(),
}));

const {
    isNotificationAPISupported,
    getNotificationPermission,
    NotificationPermissionDenied,
    NotificationPermissionGranted,
} = jest.requireMock('utils/notifications');

const {useDesktopAppNotificationPermission} = jest.requireMock('components/common/hooks/use_desktop_notification_permission');

describe('NotificationPermissionSectionNotice', () => {
    beforeEach(() => {
        jest.clearAllMocks();

        // Set default mock implementation for useDesktopAppNotificationPermission
        useDesktopAppNotificationPermission.mockReturnValue([undefined, jest.fn()]);
    });

    test('should render "Unsupported" notice when notifications are not supported', () => {
        isNotificationAPISupported.mockReturnValue(false);

        renderWithContext(<NotificationPermissionSectionNotice/>);

        expect(screen.getByText('Browser notifications unsupported')).toBeInTheDocument();
    });

    test('should render "Never granted" notice when notifications are never granted', () => {
        isNotificationAPISupported.mockReturnValue(true);
        getNotificationPermission.mockReturnValue('default');

        renderWithContext(<NotificationPermissionSectionNotice/>);

        expect(screen.getByText('Browser notifications are disabled')).toBeInTheDocument();
    });

    test('should render "Denied" notice when notifications are denied', () => {
        isNotificationAPISupported.mockReturnValue(true);
        getNotificationPermission.mockReturnValue('denied');

        renderWithContext(<NotificationPermissionSectionNotice/>);

        expect(screen.getByText('Browser notification permission was denied')).toBeInTheDocument();
    });

    test('should render nothing when notifications are granted', () => {
        isNotificationAPISupported.mockReturnValue(true);
        getNotificationPermission.mockReturnValue('granted');

        const {container} = renderWithContext(<NotificationPermissionSectionNotice/>);

        expect(container).toBeEmptyDOMElement();
    });

    test('should render "Desktop denied" notice when desktop permission is denied', () => {
        isNotificationAPISupported.mockReturnValue(true);
        useDesktopAppNotificationPermission.mockReturnValue([NotificationPermissionDenied as DesktopNotificationPermission, jest.fn()]);

        renderWithContext(<NotificationPermissionSectionNotice/>);

        expect(screen.getByText('Desktop notifications permission required')).toBeInTheDocument();
    });

    test('should render nothing when desktop permission is granted', () => {
        isNotificationAPISupported.mockReturnValue(true);
        useDesktopAppNotificationPermission.mockReturnValue([NotificationPermissionGranted as DesktopNotificationPermission, jest.fn()]);

        const {container} = renderWithContext(<NotificationPermissionSectionNotice/>);

        expect(container).toBeEmptyDOMElement();
    });
});
