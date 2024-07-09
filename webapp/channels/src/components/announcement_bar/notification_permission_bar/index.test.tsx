// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {screen, fireEvent, act} from '@testing-library/react';
import React from 'react';

import {renderWithContext} from 'tests/react_testing_utils';
import {requestNotificationPermission, isNotificationAPISupported} from 'utils/notifications';

import NotificationPermissionBar from './index';

jest.mock('utils/notifications', () => ({
    requestNotificationPermission: jest.fn(),
    isNotificationAPISupported: jest.fn(),
}));

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
        (isNotificationAPISupported as jest.Mock).mockReturnValue(true);
        (window as any).Notification = {permission: 'default'};
    });

    afterEach(() => {
        jest.clearAllMocks();
        delete (window as any).Notification;
    });

    test('should render the notification bar when conditions are met', () => {
        const {container} = renderWithContext(<NotificationPermissionBar/>, initialState);

        expect(container).toMatchSnapshot();
        expect(screen.getByText('We need your permission to show desktop notifications.')).toBeInTheDocument();
        expect(screen.getByText('Enable notifications')).toBeInTheDocument();
    });

    test('should not render the notification bar if user is not logged in', () => {
        const {container} = renderWithContext(<NotificationPermissionBar/>);

        expect(container).toMatchSnapshot();
        expect(screen.queryByText('We need your permission to show desktop notifications.')).not.toBeInTheDocument();
    });

    test('should not render the notification bar if Notifications are not supported', () => {
        delete (window as any).Notification;
        (isNotificationAPISupported as jest.Mock).mockReturnValue(false);

        const {container} = renderWithContext(<NotificationPermissionBar/>, initialState);

        expect(container).toMatchSnapshot();
        expect(screen.queryByText('We need your permission to show desktop notifications.')).not.toBeInTheDocument();
    });

    test('should call requestNotificationPermission and hide the bar when the button is clicked', async () => {
        (requestNotificationPermission as jest.Mock).mockResolvedValue('granted');

        renderWithContext(<NotificationPermissionBar/>, initialState);

        expect(screen.getByText('We need your permission to show desktop notifications.')).toBeInTheDocument();

        await act(async () => {
            fireEvent.click(screen.getByText('Enable notifications'));
        });

        expect(requestNotificationPermission).toHaveBeenCalled();
        expect(screen.queryByText('We need your permission to show desktop notifications.')).not.toBeInTheDocument();
    });
});
