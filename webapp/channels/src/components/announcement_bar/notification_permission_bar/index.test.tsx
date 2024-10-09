// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {screen, waitFor} from '@testing-library/react';
import React from 'react';

import {renderWithContext, userEvent} from 'tests/react_testing_utils';
import {requestNotificationPermission, isNotificationAPISupported, NotificationPermissionNeverGranted} from 'utils/notifications';

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
        (window as any).Notification = {permission: NotificationPermissionNeverGranted};
    });

    afterEach(() => {
        jest.clearAllMocks();
        delete (window as any).Notification;
    });

    test('should not render anything if user is not logged in', () => {
        const {container} = renderWithContext(<NotificationPermissionBar/>);

        expect(container).toBeEmptyDOMElement();
    });

    test('should render the NotificationUnsupportedBar if notifications are not supported', () => {
        delete (window as any).Notification;
        (isNotificationAPISupported as jest.Mock).mockReturnValue(false);

        renderWithContext(<NotificationPermissionBar/>, initialState);

        expect(screen.queryByText('Your browser does not support desktop notifications.')).toBeInTheDocument();
        expect(screen.queryByText('Update your browser')).toBeInTheDocument();
    });

    test('should render the NotificationPermissionNeverGrantedBar when permission is never granted yet', () => {
        renderWithContext(<NotificationPermissionBar/>, initialState);

        expect(screen.getByText('We need your permission to show desktop notifications.')).toBeInTheDocument();
        expect(screen.getByText('Enable notifications')).toBeInTheDocument();
    });

    test('should call requestNotificationPermission and hide the bar when the button is clicked in NotificationPermissionNeverGrantedBar', async () => {
        (requestNotificationPermission as jest.Mock).mockResolvedValue('granted');

        renderWithContext(<NotificationPermissionBar/>, initialState);

        expect(screen.getByText('We need your permission to show desktop notifications.')).toBeInTheDocument();

        await waitFor(async () => {
            userEvent.click(screen.getByText('Enable notifications'));
        });

        expect(requestNotificationPermission).toHaveBeenCalled();
        expect(screen.queryByText('We need your permission to show desktop notifications.')).not.toBeInTheDocument();
    });
});
