// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import * as useDesktopAppNotificationPermission from 'components/common/hooks/use_desktop_notification_permission';
import type {DesktopNotificationPermission} from 'components/common/hooks/use_desktop_notification_permission';

import {renderWithContext, screen} from 'tests/react_testing_utils';
import * as utilsNotifications from 'utils/notifications';

import NotificationPermissionTitleTag from './index';

describe('NotificationPermissionTitleTag', () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('should render "Not supported" tag when notifications are not supported', async () => {
        jest.spyOn(utilsNotifications, 'isNotificationAPISupported').mockReturnValue(false);

        await renderWithContext(<NotificationPermissionTitleTag/>);

        expect(screen.queryByText('Not supported')).toBeInTheDocument();
    });

    test('should render "Permission required" tag when permission is never granted yet', async () => {
        jest.spyOn(utilsNotifications, 'isNotificationAPISupported').mockReturnValue(true);
        jest.spyOn(utilsNotifications, 'getNotificationPermission').mockReturnValue(utilsNotifications.NotificationPermissionNeverGranted);

        await renderWithContext(<NotificationPermissionTitleTag/>);

        expect(screen.queryByText('Permission required')).toBeInTheDocument();
    });

    test('should render "Permission required" tag when permission is denied', async () => {
        jest.spyOn(utilsNotifications, 'isNotificationAPISupported').mockReturnValue(true);
        jest.spyOn(utilsNotifications, 'getNotificationPermission').mockReturnValue(utilsNotifications.NotificationPermissionDenied);

        await renderWithContext(<NotificationPermissionTitleTag/>);

        expect(screen.queryByText('Permission required')).toBeInTheDocument();
    });

    test('should render nothing when permission is granted', async () => {
        jest.spyOn(utilsNotifications, 'isNotificationAPISupported').mockReturnValue(true);
        jest.spyOn(utilsNotifications, 'getNotificationPermission').mockReturnValue(utilsNotifications.NotificationPermissionGranted);

        const {container} = await renderWithContext(<NotificationPermissionTitleTag/>);

        expect(container).toBeEmptyDOMElement();
    });

    test('should render "Permission required" tag when desktop permission is denied', async () => {
        jest.spyOn(utilsNotifications, 'isNotificationAPISupported').mockReturnValue(true);
        jest.spyOn(useDesktopAppNotificationPermission, 'useDesktopAppNotificationPermission').mockReturnValue([utilsNotifications.NotificationPermissionDenied as DesktopNotificationPermission, jest.fn()]);

        await renderWithContext(<NotificationPermissionTitleTag/>);

        expect(screen.queryByText('Permission required')).toBeInTheDocument();
    });

    test('should render nothing when desktop permission is granted', async () => {
        jest.spyOn(utilsNotifications, 'isNotificationAPISupported').mockReturnValue(true);
        jest.spyOn(useDesktopAppNotificationPermission, 'useDesktopAppNotificationPermission').mockReturnValue([utilsNotifications.NotificationPermissionGranted as DesktopNotificationPermission, jest.fn()]);

        const {container} = await renderWithContext(<NotificationPermissionTitleTag/>);

        expect(container).toBeEmptyDOMElement();
    });
});
