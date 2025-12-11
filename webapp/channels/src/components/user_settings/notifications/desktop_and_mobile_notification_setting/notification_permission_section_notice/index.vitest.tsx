// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import * as useDesktopAppNotificationPermission from 'components/common/hooks/use_desktop_notification_permission';
import type {DesktopNotificationPermission} from 'components/common/hooks/use_desktop_notification_permission';

import {renderWithContext, screen} from 'tests/vitest_react_testing_utils';
import * as utilsNotifications from 'utils/notifications';

import NotificationPermissionSectionNotice from './index';

describe('NotificationPermissionSectionNotice', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    test('should render "Unsupported" notice when notifications are not supported', () => {
        vi.spyOn(utilsNotifications, 'isNotificationAPISupported').mockReturnValue(false);

        renderWithContext(<NotificationPermissionSectionNotice/>);

        expect(screen.getByText('Browser notifications unsupported')).toBeInTheDocument();
    });

    test('should render "Never granted" notice when notifications are never granted', () => {
        vi.spyOn(utilsNotifications, 'isNotificationAPISupported').mockReturnValue(true);
        vi.spyOn(utilsNotifications, 'getNotificationPermission').mockReturnValue('default');

        renderWithContext(<NotificationPermissionSectionNotice/>);

        expect(screen.getByText('Browser notifications are disabled')).toBeInTheDocument();
    });

    test('should render "Denied" notice when notifications are denied', () => {
        vi.spyOn(utilsNotifications, 'isNotificationAPISupported').mockReturnValue(true);
        vi.spyOn(utilsNotifications, 'getNotificationPermission').mockReturnValue('denied');

        renderWithContext(<NotificationPermissionSectionNotice/>);

        expect(screen.getByText('Browser notification permission was denied')).toBeInTheDocument();
    });

    test('should render nothing when notifications are granted', () => {
        vi.spyOn(utilsNotifications, 'isNotificationAPISupported').mockReturnValue(true);
        vi.spyOn(utilsNotifications, 'getNotificationPermission').mockReturnValue('granted');

        const {container} = renderWithContext(<NotificationPermissionSectionNotice/>);

        expect(container).toBeEmptyDOMElement();
    });

    test('should render "Desktop denied" notice when desktop permission is denied', () => {
        vi.spyOn(utilsNotifications, 'isNotificationAPISupported').mockReturnValue(true);
        vi.spyOn(useDesktopAppNotificationPermission, 'useDesktopAppNotificationPermission').mockReturnValue([utilsNotifications.NotificationPermissionDenied as DesktopNotificationPermission, vi.fn()]);

        renderWithContext(<NotificationPermissionSectionNotice/>);

        expect(screen.getByText('Desktop notifications permission required')).toBeInTheDocument();
    });

    test('should render nothing when desktop permission is granted', () => {
        vi.spyOn(utilsNotifications, 'isNotificationAPISupported').mockReturnValue(true);
        vi.spyOn(useDesktopAppNotificationPermission, 'useDesktopAppNotificationPermission').mockReturnValue([utilsNotifications.NotificationPermissionGranted as DesktopNotificationPermission, vi.fn()]);

        const {container} = renderWithContext(<NotificationPermissionSectionNotice/>);

        expect(container).toBeEmptyDOMElement();
    });
});
