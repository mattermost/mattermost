// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen} from 'tests/react_testing_utils';
import * as utilsNotifications from 'utils/notifications';

import NotificationPermissionTitleTag from './index';

describe('NotificationPermissionTitleTag', () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('should render "Not supported" tag when notifications are not supported', () => {
        jest.spyOn(utilsNotifications, 'isNotificationAPISupported').mockReturnValue(false);

        renderWithContext(<NotificationPermissionTitleTag/>);

        expect(screen.queryByText('Not supported')).toBeInTheDocument();
    });

    test('should render "Permission required" tag when permission is never granted yet', () => {
        jest.spyOn(utilsNotifications, 'isNotificationAPISupported').mockReturnValue(true);
        jest.spyOn(utilsNotifications, 'getNotificationPermission').mockReturnValue(utilsNotifications.NotificationPermissionNeverGranted);

        renderWithContext(<NotificationPermissionTitleTag/>);

        expect(screen.queryByText('Permission required')).toBeInTheDocument();
    });

    test('should render "Permission required" tag when permission is denied', () => {
        jest.spyOn(utilsNotifications, 'isNotificationAPISupported').mockReturnValue(true);
        jest.spyOn(utilsNotifications, 'getNotificationPermission').mockReturnValue(utilsNotifications.NotificationPermissionDenied);

        renderWithContext(<NotificationPermissionTitleTag/>);

        expect(screen.queryByText('Permission required')).toBeInTheDocument();
    });

    test('should render nothing when permission is granted', () => {
        jest.spyOn(utilsNotifications, 'isNotificationAPISupported').mockReturnValue(true);
        jest.spyOn(utilsNotifications, 'getNotificationPermission').mockReturnValue(utilsNotifications.NotificationPermissionGranted);

        const {container} = renderWithContext(<NotificationPermissionTitleTag/>);

        expect(container).toBeEmptyDOMElement();
    });
});
