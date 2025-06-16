// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {render, screen, fireEvent, waitFor} from '@testing-library/react';
import React from 'react';
import {IntlProvider} from 'react-intl';
import {Provider} from 'react-redux';

import testConfigureStore from 'tests/test_store';

import InteractiveDialogAdapter from './interactive_dialog_adapter';

// Mock the AppsForm component
jest.mock('components/apps_form/apps_form_component', () => ({
    AppsForm: ({actions, onExited, onHide}: any) => (
        <div data-testid='apps-form'>
            <button
                data-testid='submit-button'
                onClick={() => actions.submit({values: {test_field: 'test_value'}})}
            >
                {'Submit'}
            </button>
            <button
                data-testid='hide-button'
                onClick={onHide}
            >
                {'Hide'}
            </button>
            <button
                data-testid='exit-button'
                onClick={onExited}
            >
                {'Exit'}
            </button>
        </div>
    ),
}));

describe('InteractiveDialogAdapter', () => {
    const baseProps = {
        dialogRequest: {
            trigger_id: 'test-trigger-id',
            url: 'http://example.com/submit',
            dialog: {
                callback_id: 'test-callback',
                title: 'Test Dialog',
                elements: [
                    {
                        display_name: 'Test Field',
                        name: 'test_field',
                        type: 'text',
                        default: '',
                        optional: false,
                    },
                ],
                state: 'test-state',
                notify_on_cancel: false,
            },
        },
        onExited: jest.fn(),
        onHide: jest.fn(),
        actions: {
            submitInteractiveDialog: jest.fn(),
        },
    };

    const store = testConfigureStore({
        entities: {
            users: {currentUserId: 'user-id'},
            channels: {currentChannelId: 'channel-id'},
            teams: {currentTeamId: 'team-id'},
        },
    });

    const renderComponent = (props = {}) => {
        return render(
            <Provider store={store}>
                <IntlProvider
                    locale='en'
                    {...props}
                >
                    <InteractiveDialogAdapter
                        {...baseProps}
                        {...props}
                    />
                </IntlProvider>
            </Provider>,
        );
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('should render AppsForm with converted dialog data', () => {
        renderComponent();
        expect(screen.getByTestId('apps-form')).toBeInTheDocument();
    });

    test('should handle successful submission', async () => {
        const mockSubmit = jest.fn().mockResolvedValue({
            data: {},
        });

        renderComponent({
            actions: {
                submitInteractiveDialog: mockSubmit,
            },
        });

        fireEvent.click(screen.getByTestId('submit-button'));

        await waitFor(() => {
            expect(mockSubmit).toHaveBeenCalledWith({
                type: 'dialog_submission',
                url: 'http://example.com/submit',
                callback_id: 'test-callback',
                state: 'test-state',
                submission: {test_field: 'test_value'},
                cancelled: false,
                user_id: 'user-id',
                channel_id: 'channel-id',
                team_id: 'team-id',
            });
        });
    });

    test('should handle server-side validation errors correctly', async () => {
        const mockSubmitWithFieldErrors = jest.fn().mockResolvedValue({
            data: {
                error: 'Form validation failed',
                errors: {
                    test_field: 'This field is required',
                    email_field: 'Invalid email format',
                },
            },
        });

        renderComponent({
            actions: {
                submitInteractiveDialog: mockSubmitWithFieldErrors,
            },
        });

        fireEvent.click(screen.getByTestId('submit-button'));

        await waitFor(() => {
            expect(mockSubmitWithFieldErrors).toHaveBeenCalled();
        });

        // The error should be handled and form should remain open (not exit)
        expect(baseProps.onExited).not.toHaveBeenCalled();
    });

    test('should handle server-side general errors correctly', async () => {
        const mockSubmitWithGeneralError = jest.fn().mockResolvedValue({
            data: {
                error: 'Server error occurred',
            },
        });

        renderComponent({
            actions: {
                submitInteractiveDialog: mockSubmitWithGeneralError,
            },
        });

        fireEvent.click(screen.getByTestId('submit-button'));

        await waitFor(() => {
            expect(mockSubmitWithGeneralError).toHaveBeenCalled();
        });

        // The error should be handled and form should remain open (not exit)
        expect(baseProps.onExited).not.toHaveBeenCalled();
    });

    test('should handle direct response errors correctly', async () => {
        const mockSubmitWithDirectError = jest.fn().mockResolvedValue({
            error: 'Network error',
            errors: {
                network: 'Connection failed',
            },
        });

        renderComponent({
            actions: {
                submitInteractiveDialog: mockSubmitWithDirectError,
            },
        });

        fireEvent.click(screen.getByTestId('submit-button'));

        await waitFor(() => {
            expect(mockSubmitWithDirectError).toHaveBeenCalled();
        });

        // The error should be handled and form should remain open (not exit)
        expect(baseProps.onExited).not.toHaveBeenCalled();
    });

    test('should handle network exceptions correctly', async () => {
        const mockSubmitWithException = jest.fn().mockRejectedValue(new Error('Network timeout'));

        renderComponent({
            actions: {
                submitInteractiveDialog: mockSubmitWithException,
            },
        });

        fireEvent.click(screen.getByTestId('submit-button'));

        await waitFor(() => {
            expect(mockSubmitWithException).toHaveBeenCalled();
        });

        // The error should be handled and form should remain open (not exit)
        expect(baseProps.onExited).not.toHaveBeenCalled();
    });

    test('should call onExited when provided', () => {
        renderComponent();
        fireEvent.click(screen.getByTestId('exit-button'));
        expect(baseProps.onExited).toHaveBeenCalled();
    });

    test('should handle dialog cancellation with notify_on_cancel enabled', () => {
        const mockSubmit = jest.fn();
        const dialogRequest = {
            ...baseProps.dialogRequest,
            dialog: {
                ...baseProps.dialogRequest.dialog,
                notify_on_cancel: true,
            },
        };

        renderComponent({
            dialogRequest,
            actions: {
                submitInteractiveDialog: mockSubmit,
            },
        });

        fireEvent.click(screen.getByTestId('hide-button'));

        expect(mockSubmit).toHaveBeenCalledWith({
            type: 'dialog_submission',
            url: 'http://example.com/submit',
            callback_id: 'test-callback',
            state: 'test-state',
            cancelled: true,
            user_id: '',
            channel_id: '',
            team_id: '',
            submission: {},
        });
    });

    test('should not notify on cancel when notify_on_cancel is disabled', () => {
        const mockSubmit = jest.fn();

        renderComponent({
            actions: {
                submitInteractiveDialog: mockSubmit,
            },
        });

        fireEvent.click(screen.getByTestId('hide-button'));

        expect(mockSubmit).not.toHaveBeenCalled();
    });
});
