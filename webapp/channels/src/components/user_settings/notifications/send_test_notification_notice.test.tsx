// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {sendTestNotification} from 'actions/notification_actions';

import {act, renderWithContext, screen, waitFor} from 'tests/react_testing_utils';

import SendTestNotificationNotice from './send_test_notification_notice';

jest.mock('actions/notification_actions', () => ({
    sendTestNotification: jest.fn().mockResolvedValue({status: 'OK'}),
}));

const mockedSendTestNotification = jest.mocked(sendTestNotification);

describe('components/user_settings/notifications/send_test_notification_notice', () => {
    jest.useFakeTimers();
    it('should match snapshot', () => {
        const {container} = renderWithContext((<SendTestNotificationNotice/>));
        expect(container).toMatchSnapshot();
    });
    it('should not show on admin mode', () => {
        const {container} = renderWithContext((<SendTestNotificationNotice adminMode={true}/>));
        expect(container).toBeEmptyDOMElement();
    });
    it('should send the notificaton when the send button is clicked', async () => {
        renderWithContext((<SendTestNotificationNotice/>));
        expect(mockedSendTestNotification).not.toHaveBeenCalled();
        act(() => screen.getByText('Send a test notification').click());
        await waitFor(() => {
            expect(mockedSendTestNotification).toHaveBeenCalled();
            expect(screen.getByText('Test notification sent')).toBeInTheDocument();
        });
    });
    it('should open link when the secondary button is clicked', () => {
        const originalOpen = window.open;
        const mockedOpen = jest.fn();
        window.open = mockedOpen;

        renderWithContext((<SendTestNotificationNotice/>));
        expect(mockedOpen).not.toHaveBeenCalled();
        act(() => screen.getByText('Troubleshooting docs').click());
        expect(mockedOpen).toHaveBeenCalled();

        window.open = originalOpen;
    });
    it('should show error on button when the system returns an error', async () => {
        mockedSendTestNotification.mockResolvedValueOnce({status: 'NOT OK'});

        const originalConsole = console.error;
        const mockedConsole = jest.fn();
        console.error = mockedConsole;

        renderWithContext((<SendTestNotificationNotice/>));
        expect(mockedSendTestNotification).not.toHaveBeenCalled();
        act(() => screen.getByText('Send a test notification').click());
        await waitFor(() => {
            expect(mockedSendTestNotification).toHaveBeenCalled();
            expect(screen.getByText('Error sending test notification')).toBeInTheDocument();
            expect(mockedConsole).toHaveBeenCalledWith({status: 'NOT OK'});
        });

        console.error = originalConsole;
    });
});
