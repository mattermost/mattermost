// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {DesktopNotificationPermission} from 'components/common/hooks/use_desktop_notification_permission';

import {renderWithContext, screen} from 'tests/react_testing_utils';
import {
    NotificationPermissionNeverGranted,
    NotificationPermissionGranted,
    NotificationPermissionDenied,
    isNotificationAPISupported, getNotificationPermission} from 'utils/notifications';

import NotificationPermissionTitleTag from './index';

jest.mock('utils/notifications', () => ({
    ...jest.requireActual('utils/notifications'),
    isNotificationAPISupported: jest.fn(),
    getNotificationPermission: jest.fn(),
}));

jest.mock('components/common/hooks/use_desktop_notification_permission', () => ({
    ...jest.requireActual('components/common/hooks/use_desktop_notification_permission'),
    useDesktopAppNotificationPermission: jest.fn(),
}));

import {useDesktopAppNotificationPermission} from 'components/common/hooks/use_desktop_notification_permission';

describe('NotificationPermissionTitleTag', () => {
    beforeEach(() => {
        jest.clearAllMocks();

        // Provide default mock implementations
        (isNotificationAPISupported as jest.Mock).mockReturnValue(true);
        (getNotificationPermission as jest.Mock).mockReturnValue(NotificationPermissionGranted);
        (useDesktopAppNotificationPermission as jest.Mock).mockReturnValue([undefined, jest.fn()]);
    });

    test('should render "Not supported" tag when notifications are not supported', () => {
        (isNotificationAPISupported as jest.Mock).mockReturnValue(false);

        renderWithContext(<NotificationPermissionTitleTag/>);

        expect(screen.queryByText('Not supported')).toBeInTheDocument();
    });

    test('should render "Permission required" tag when permission is never granted yet', () => {
        (isNotificationAPISupported as jest.Mock).mockReturnValue(true);
        (getNotificationPermission as jest.Mock).mockReturnValue(NotificationPermissionNeverGranted);

        renderWithContext(<NotificationPermissionTitleTag/>);

        expect(screen.queryByText('Permission required')).toBeInTheDocument();
    });

    test('should render "Permission required" tag when permission is denied', () => {
        (isNotificationAPISupported as jest.Mock).mockReturnValue(true);
        (getNotificationPermission as jest.Mock).mockReturnValue(NotificationPermissionDenied);

        renderWithContext(<NotificationPermissionTitleTag/>);

        expect(screen.queryByText('Permission required')).toBeInTheDocument();
    });

    test('should render nothing when permission is granted', () => {
        (isNotificationAPISupported as jest.Mock).mockReturnValue(true);
        (getNotificationPermission as jest.Mock).mockReturnValue(NotificationPermissionGranted);

        const {container} = renderWithContext(<NotificationPermissionTitleTag/>);

        expect(container).toBeEmptyDOMElement();
    });

    test('should render "Permission required" tag when desktop permission is denied', () => {
        (isNotificationAPISupported as jest.Mock).mockReturnValue(true);
        (useDesktopAppNotificationPermission as jest.Mock).mockReturnValue([NotificationPermissionDenied as DesktopNotificationPermission, jest.fn()]);

        renderWithContext(<NotificationPermissionTitleTag/>);

        expect(screen.queryByText('Permission required')).toBeInTheDocument();
    });

    test('should render nothing when desktop permission is granted', () => {
        (isNotificationAPISupported as jest.Mock).mockReturnValue(true);
        (useDesktopAppNotificationPermission as jest.Mock).mockReturnValue([NotificationPermissionGranted as DesktopNotificationPermission, jest.fn()]);

        const {container} = renderWithContext(<NotificationPermissionTitleTag/>);

        expect(container).toBeEmptyDOMElement();
    });
});
