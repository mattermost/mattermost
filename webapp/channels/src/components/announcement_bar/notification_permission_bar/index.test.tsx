// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, userEvent, screen} from 'tests/react_testing_utils';

import NotificationPermissionBar from './index';

jest.mock('utils/notifications', () => ({
    isNotificationAPISupported: jest.fn(),
    getNotificationPermission: jest.fn(),
    requestNotificationPermission: jest.fn(),
    NotificationPermissionNeverGranted: 'default',
    NotificationPermissionGranted: 'granted',
    NotificationPermissionDenied: 'denied',
}));

const {
    isNotificationAPISupported,
    getNotificationPermission,
    requestNotificationPermission,
    NotificationPermissionNeverGranted,
    NotificationPermissionGranted,
} = jest.requireMock('utils/notifications');

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

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('should not render anything if user is not logged in', () => {
        const {container} = renderWithContext(<NotificationPermissionBar/>);

        expect(container).toBeEmptyDOMElement();
    });

    test('should render the NotificationUnsupportedBar if notifications are not supported', () => {
        isNotificationAPISupported.mockReturnValue(false);

        const {container} = renderWithContext(<NotificationPermissionBar/>, initialState);

        expect(container).toMatchSnapshot();

        expect(screen.queryByText('Your browser does not support browser notifications.')).toBeInTheDocument();
        expect(screen.queryByText('Update your browser')).toBeInTheDocument();
    });

    test('should render the NotificationPermissionNeverGrantedBar when permission is never granted yet', () => {
        isNotificationAPISupported.mockReturnValue(true);
        getNotificationPermission.mockReturnValue(NotificationPermissionNeverGranted);

        const {container} = renderWithContext(<NotificationPermissionBar/>, initialState);

        expect(container).toMatchSnapshot();

        expect(screen.getByText('We need your permission to show notifications in the browser.')).toBeInTheDocument();
        expect(screen.getByText('Manage notification preferences')).toBeInTheDocument();
    });

    test('should call requestNotificationPermission and hide the bar when the button is clicked in NotificationPermissionNeverGrantedBar', async () => {
        isNotificationAPISupported.mockReturnValue(true);
        getNotificationPermission.mockReturnValue(NotificationPermissionNeverGranted);
        requestNotificationPermission.mockResolvedValue(NotificationPermissionGranted);

        renderWithContext(<NotificationPermissionBar/>, initialState);

        expect(screen.getByText('We need your permission to show notifications in the browser.')).toBeInTheDocument();

        await userEvent.click(screen.getByText('Manage notification preferences'));

        expect(requestNotificationPermission).toHaveBeenCalled();
        expect(screen.queryByText('We need your permission to show browser notifications.')).not.toBeInTheDocument();
    });

    test('should not render anything if permission is denied', () => {
        isNotificationAPISupported.mockReturnValue(true);
        getNotificationPermission.mockReturnValue('denied');

        const {container} = renderWithContext(<NotificationPermissionBar/>, initialState);

        expect(container).toBeEmptyDOMElement();
    });

    test('should not render anything if permission is granted', () => {
        isNotificationAPISupported.mockReturnValue(true);
        getNotificationPermission.mockReturnValue('granted');

        const {container} = renderWithContext(<NotificationPermissionBar/>, initialState);

        expect(container).toBeEmptyDOMElement();
    });

    test('should not render anything in cloud preview environment', () => {
        isNotificationAPISupported.mockReturnValue(true);
        getNotificationPermission.mockReturnValue(NotificationPermissionNeverGranted);

        const stateWithCloudPreview = {
            ...initialState,
            entities: {
                ...initialState.entities,
                cloud: {
                    subscription: {
                        is_cloud_preview: true,
                    },
                },
            },
        };

        const {container} = renderWithContext(<NotificationPermissionBar/>, stateWithCloudPreview);

        expect(container).toBeEmptyDOMElement();
    });
});
