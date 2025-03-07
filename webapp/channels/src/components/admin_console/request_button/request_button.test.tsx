// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {act, waitFor, screen, fireEvent} from '@testing-library/react';
import {FormattedMessage} from 'react-intl';

import {renderWithContext} from 'tests/react_testing_utils';
import RequestButton from 'components/admin_console/request_button/request_button';

describe('components/admin_console/request_button/request_button.jsx', () => {
    const defaultProps = {
        requestAction: jest.fn(),
        helpText: <FormattedMessage id='test1' defaultMessage='Help Text' />,
        buttonText: <FormattedMessage id='test2' defaultMessage='Button Text' />,
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('should render correctly with default props', () => {
        renderWithContext(
            <RequestButton
                {...defaultProps}
            />
        );

        // Verify button text
        expect(screen.getByText('Button Text')).toBeInTheDocument();
        
        // Verify help text
        expect(screen.getByText('Help Text')).toBeInTheDocument();
        
        // Verify button is enabled
        const button = screen.getByRole('button');
        expect(button).not.toBeDisabled();
    });

    test('should call only request action when saveNeeded is false', async () => {
        const requestActionSuccess = jest.fn((success) => success());
        const saveConfigActionSuccess = jest.fn((success) => success());

        renderWithContext(
            <RequestButton
                {...defaultProps}
                requestAction={requestActionSuccess}
                saveNeeded={false}
                saveConfigAction={saveConfigActionSuccess}
            />
        );

        // Click the button
        fireEvent.click(screen.getByRole('button'));

        // Verify only the request action was called
        await waitFor(() => {
            expect(requestActionSuccess).toHaveBeenCalledTimes(1);
            expect(saveConfigActionSuccess).not.toHaveBeenCalled();
        });
    });

    test('should call saveConfig and request actions when saveNeeded is true', async () => {
        const requestActionSuccess = jest.fn((success) => success());
        const saveConfigActionSuccess = jest.fn((success) => success());

        renderWithContext(
            <RequestButton
                {...defaultProps}
                requestAction={requestActionSuccess}
                saveNeeded={true}
                saveConfigAction={saveConfigActionSuccess}
            />
        );

        // Click the button
        fireEvent.click(screen.getByRole('button'));

        // Verify both actions were called
        await waitFor(() => {
            expect(requestActionSuccess).toHaveBeenCalledTimes(1);
            expect(saveConfigActionSuccess).toHaveBeenCalledTimes(1);
        });
    });

    test('should show success message when request succeeds and showSuccessMessage is true', async () => {
        const requestActionSuccess = jest.fn((success) => success());

        renderWithContext(
            <RequestButton
                {...defaultProps}
                requestAction={requestActionSuccess}
                showSuccessMessage={true}
                successMessage={{
                    id: 'success.message',
                    defaultMessage: 'Success Message',
                }}
            />
        );

        // Click the button
        act(() => {
            fireEvent.click(screen.getByRole('button'));
        });

        // Verify success message is shown
        await waitFor(() => {
            expect(screen.getByText('Success Message')).toBeInTheDocument();
            expect(screen.getByText('Success Message').closest('.alert-success')).toBeInTheDocument();
        });
    });

    test('should not show success message when request succeeds and showSuccessMessage is false', async () => {
        const requestActionSuccess = jest.fn((success) => success());

        renderWithContext(
            <RequestButton
                {...defaultProps}
                requestAction={requestActionSuccess}
                showSuccessMessage={false}
                successMessage={{
                    id: 'success.message',
                    defaultMessage: 'Success Message',
                }}
            />
        );

        // Click the button
        act(() => {
            fireEvent.click(screen.getByRole('button'));
        });

        // Verify success message is not shown
        await waitFor(() => {
            expect(screen.queryByText('Success Message')).not.toBeInTheDocument();
        });
    });

    test('should show error message with detailed error when request fails and includeDetailedError is true', async () => {
        const requestActionFailure = jest.fn((success, error) => error({
            message: '__message__',
            detailed_error: '__detailed_error__',
        }));

        renderWithContext(
            <RequestButton
                {...defaultProps}
                requestAction={requestActionFailure}
                includeDetailedError={true}
                errorMessage={{
                    id: 'error.message',
                    defaultMessage: 'Error Message: {error}',
                }}
            />
        );

        // Click the button
        act(() => {
            fireEvent.click(screen.getByRole('button'));
        });

        // Verify error message is shown with detailed error
        await waitFor(() => {
            expect(screen.getByText('Error Message: __message__ - __detailed_error__')).toBeInTheDocument();
            expect(screen.getByText('Error Message: __message__ - __detailed_error__').closest('.alert-warning')).toBeInTheDocument();
        });
    });

    test('should show error message without detailed error when request fails and includeDetailedError is false', async () => {
        const requestActionFailure = jest.fn((success, error) => error({
            message: '__message__',
            detailed_error: '__detailed_error__',
        }));

        renderWithContext(
            <RequestButton
                {...defaultProps}
                requestAction={requestActionFailure}
                includeDetailedError={false}
                errorMessage={{
                    id: 'error.message',
                    defaultMessage: 'Error Message: {error}',
                }}
            />
        );

        // Click the button
        act(() => {
            fireEvent.click(screen.getByRole('button'));
        });

        // Verify error message is shown without detailed error
        await waitFor(() => {
            expect(screen.getByText('Error Message: __message__')).toBeInTheDocument();
            expect(screen.queryByText('Error Message: __message__ - __detailed_error__')).not.toBeInTheDocument();
        });
    });
    
    test('should show loading text when button is clicked', async () => {
        // Mock implementation that doesn't immediately resolve
        const slowRequestAction = jest.fn(() => {
            // Don't call success or error callbacks immediately
        });
        
        renderWithContext(
            <RequestButton
                {...defaultProps}
                requestAction={slowRequestAction}
            />
        );
        
        // Click the button
        fireEvent.click(screen.getByRole('button'));
        
        // Verify loading text is shown
        expect(screen.getByText('Loading...')).toBeInTheDocument();
    });
});
