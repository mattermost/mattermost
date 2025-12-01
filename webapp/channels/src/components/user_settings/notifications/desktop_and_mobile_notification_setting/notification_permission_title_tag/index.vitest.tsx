// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import * as useDesktopAppNotificationPermission from 'components/common/hooks/use_desktop_notification_permission';
import type {DesktopNotificationPermission} from 'components/common/hooks/use_desktop_notification_permission';

import {renderWithContext, screen} from 'tests/vitest_react_testing_utils';
import * as utilsNotifications from 'utils/notifications';

import NotificationPermissionTitleTag from './index';

describe('NotificationPermissionTitleTag', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    test('should render "Not supported" tag when notifications are not supported', () => {
        vi.spyOn(utilsNotifications, 'isNotificationAPISupported').mockReturnValue(false);

        renderWithContext(<NotificationPermissionTitleTag/>);

        expect(screen.queryByText('Not supported')).toBeInTheDocument();
    });

    test('should render "Permission required" tag when permission is never granted yet', () => {
        vi.spyOn(utilsNotifications, 'isNotificationAPISupported').mockReturnValue(true);
        vi.spyOn(utilsNotifications, 'getNotificationPermission').mockReturnValue(utilsNotifications.NotificationPermissionNeverGranted);

        renderWithContext(<NotificationPermissionTitleTag/>);

        expect(screen.queryByText('Permission required')).toBeInTheDocument();
    });

    test('should render "Permission required" tag when permission is denied', () => {
        vi.spyOn(utilsNotifications, 'isNotificationAPISupported').mockReturnValue(true);
        vi.spyOn(utilsNotifications, 'getNotificationPermission').mockReturnValue(utilsNotifications.NotificationPermissionDenied);

        renderWithContext(<NotificationPermissionTitleTag/>);

        expect(screen.queryByText('Permission required')).toBeInTheDocument();
    });

    test('should render nothing when permission is granted', () => {
        vi.spyOn(utilsNotifications, 'isNotificationAPISupported').mockReturnValue(true);
        vi.spyOn(utilsNotifications, 'getNotificationPermission').mockReturnValue(utilsNotifications.NotificationPermissionGranted);

        const {container} = renderWithContext(<NotificationPermissionTitleTag/>);

        expect(container).toBeEmptyDOMElement();
    });

    test('should render "Permission required" tag when desktop permission is denied', () => {
        vi.spyOn(utilsNotifications, 'isNotificationAPISupported').mockReturnValue(true);
        vi.spyOn(useDesktopAppNotificationPermission, 'useDesktopAppNotificationPermission').mockReturnValue([utilsNotifications.NotificationPermissionDenied as DesktopNotificationPermission, vi.fn()]);

        renderWithContext(<NotificationPermissionTitleTag/>);

        expect(screen.queryByText('Permission required')).toBeInTheDocument();
    });

    test('should render nothing when desktop permission is granted', () => {
        vi.spyOn(utilsNotifications, 'isNotificationAPISupported').mockReturnValue(true);
        vi.spyOn(useDesktopAppNotificationPermission, 'useDesktopAppNotificationPermission').mockReturnValue([utilsNotifications.NotificationPermissionGranted as DesktopNotificationPermission, vi.fn()]);

        const {container} = renderWithContext(<NotificationPermissionTitleTag/>);

        expect(container).toBeEmptyDOMElement();
    });
});
