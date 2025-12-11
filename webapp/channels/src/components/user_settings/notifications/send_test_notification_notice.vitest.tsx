// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {sendTestNotification} from 'actions/notification_actions';

import {renderWithContext, screen, waitFor, userEvent} from 'tests/vitest_react_testing_utils';

import SendTestNotificationNotice from './send_test_notification_notice';

vi.mock('actions/notification_actions', () => ({
    sendTestNotification: vi.fn().mockResolvedValue({status: 'OK'}),
}));

const mockedSendTestNotification = vi.mocked(sendTestNotification);

describe('components/user_settings/notifications/send_test_notification_notice', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.clearAllMocks();
    });

    test('should match snapshot', () => {
        const {container} = renderWithContext((<SendTestNotificationNotice/>));
        expect(container).toMatchSnapshot();
    });

    test('should not show on admin mode', () => {
        const {container} = renderWithContext((<SendTestNotificationNotice adminMode={true}/>));
        expect(container).toBeEmptyDOMElement();
    });

    test('should send the notificaton when the send button is clicked', async () => {
        vi.useRealTimers();
        renderWithContext((<SendTestNotificationNotice/>));
        expect(mockedSendTestNotification).not.toHaveBeenCalled();

        await userEvent.click(screen.getByText('Send a test notification'));

        await waitFor(() => {
            expect(mockedSendTestNotification).toHaveBeenCalled();
            expect(screen.getByText('Test notification sent')).toBeInTheDocument();
        });
    });

    test('should open link when the secondary button is clicked', async () => {
        vi.useRealTimers();
        const originalOpen = window.open;
        const mockedOpen = vi.fn();
        window.open = mockedOpen;

        renderWithContext((<SendTestNotificationNotice/>));
        expect(mockedOpen).not.toHaveBeenCalled();

        await userEvent.click(screen.getByText('Troubleshooting docs'));
        expect(mockedOpen).toHaveBeenCalled();

        window.open = originalOpen;
    });

    test('should show error on button when the system returns an error', async () => {
        vi.useRealTimers();
        mockedSendTestNotification.mockResolvedValueOnce({status: 'NOT OK'});

        const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        renderWithContext((<SendTestNotificationNotice/>));
        expect(mockedSendTestNotification).not.toHaveBeenCalled();

        await userEvent.click(screen.getByText('Send a test notification'));

        await waitFor(() => {
            expect(mockedSendTestNotification).toHaveBeenCalled();
            expect(screen.getByText('Error sending test notification')).toBeInTheDocument();
            expect(consoleErrorSpy).toHaveBeenCalledWith({status: 'NOT OK'});
        });

        consoleErrorSpy.mockRestore();
    });
});
