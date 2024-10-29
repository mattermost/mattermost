// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, userEvent, screen, waitFor} from 'tests/react_testing_utils';
import * as utilsNotifications from 'utils/notifications';

import NotificationPermissionBar from './index';

describe('NotificationPermissionBar', () => {
    const initialState = {
        entities: {
            users: {
                currentUserId: 'user-id',
            },
            general: {
                config: {},
                license: {},
            },
        },
    };

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('should not render anything if user is not logged in', () => {
        const {container} = renderWithContext(<NotificationPermissionBar/>);

        expect(container).toBeEmptyDOMElement();
    });

    test('should render the NotificationUnsupportedBar if notifications are not supported', () => {
        jest.spyOn(utilsNotifications, 'isNotificationAPISupported').mockReturnValue(false);

        const {container} = renderWithContext(<NotificationPermissionBar/>, initialState);

        expect(container).toMatchSnapshot();

        expect(screen.queryByText('Your browser does not support browser notifications.')).toBeInTheDocument();
        expect(screen.queryByText('Update your browser')).toBeInTheDocument();
    });

    test('should render the NotificationPermissionNeverGrantedBar when permission is never granted yet', () => {
        jest.spyOn(utilsNotifications, 'isNotificationAPISupported').mockReturnValue(true);
        jest.spyOn(utilsNotifications, 'getNotificationPermission').mockReturnValue(utilsNotifications.NotificationPermissionNeverGranted);

        const {container} = renderWithContext(<NotificationPermissionBar/>, initialState);

        expect(container).toMatchSnapshot();

        expect(screen.getByText('We need your permission to show notifications in the browser.')).toBeInTheDocument();
        expect(screen.getByText('Manage notification preferences')).toBeInTheDocument();
    });

    test('should call requestNotificationPermission and hide the bar when the button is clicked in NotificationPermissionNeverGrantedBar', async () => {
        jest.spyOn(utilsNotifications, 'isNotificationAPISupported').mockReturnValue(true);
        jest.spyOn(utilsNotifications, 'getNotificationPermission').mockReturnValue(utilsNotifications.NotificationPermissionNeverGranted);
        jest.spyOn(utilsNotifications, 'requestNotificationPermission').mockResolvedValue(utilsNotifications.NotificationPermissionGranted);

        renderWithContext(<NotificationPermissionBar/>, initialState);

        expect(screen.getByText('We need your permission to show notifications in the browser.')).toBeInTheDocument();

        await waitFor(async () => {
            userEvent.click(screen.getByText('Manage notification preferences'));
        });

        expect(utilsNotifications.requestNotificationPermission).toHaveBeenCalled();
        expect(screen.queryByText('We need your permission to show browser notifications.')).not.toBeInTheDocument();
    });

    test('should not render anything if permission is denied', () => {
        jest.spyOn(utilsNotifications, 'isNotificationAPISupported').mockReturnValue(true);
        jest.spyOn(utilsNotifications, 'getNotificationPermission').mockReturnValue('denied');

        const {container} = renderWithContext(<NotificationPermissionBar/>, initialState);

        expect(container).toBeEmptyDOMElement();
    });

    test('should not render anything if permission is granted', () => {
        jest.spyOn(utilsNotifications, 'isNotificationAPISupported').mockReturnValue(true);
        jest.spyOn(utilsNotifications, 'getNotificationPermission').mockReturnValue('granted');

        const {container} = renderWithContext(<NotificationPermissionBar/>, initialState);

        expect(container).toBeEmptyDOMElement();
    });
});
