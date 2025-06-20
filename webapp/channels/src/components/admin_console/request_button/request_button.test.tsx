// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {screen, fireEvent} from '@testing-library/react';
import React from 'react';
import {FormattedMessage} from 'react-intl';

import RequestButton from 'components/admin_console/request_button/request_button';

import {renderWithContext} from 'tests/react_testing_utils';

describe('components/admin_console/request_button/request_button', () => {
    test('should render button with help text', () => {
        const emptyFunction = jest.fn();

        renderWithContext(
            <RequestButton
                requestAction={emptyFunction}
                helpText={
                    <FormattedMessage
                        id='test1'
                        defaultMessage='Help Text'
                    />
                }
                buttonText={
                    <FormattedMessage
                        id='test2'
                        defaultMessage='Button Text'
                    />
                }
            />,
        );

        expect(screen.getByRole('button', {name: 'Button Text'})).toBeInTheDocument();
        expect(screen.getByText('Help Text')).toBeInTheDocument();
    });

    test('should call saveConfig and request actions when saveNeeded is true', async () => {
        const requestActionSuccess = jest.fn((success) => success());
        const saveConfigActionSuccess = jest.fn((success) => success());

        renderWithContext(
            <RequestButton
                requestAction={requestActionSuccess}
                helpText={
                    <FormattedMessage
                        id='test1'
                        defaultMessage='Help Text'
                    />
                }
                buttonText={
                    <FormattedMessage
                        id='test2'
                        defaultMessage='Button Text'
                    />
                }
                saveNeeded={true}
                saveConfigAction={saveConfigActionSuccess}
            />,
        );

        fireEvent.click(screen.getByRole('button', {name: 'Button Text'}));

        expect(requestActionSuccess).toHaveBeenCalledTimes(1);
        expect(saveConfigActionSuccess).toHaveBeenCalledTimes(1);
    });

    test('should call only request action when saveNeeded is false', () => {
        const requestActionSuccess = jest.fn((success) => success());
        const saveConfigActionSuccess = jest.fn((success) => success());

        renderWithContext(
            <RequestButton
                requestAction={requestActionSuccess}
                helpText={
                    <FormattedMessage
                        id='test1'
                        defaultMessage='Help Text'
                    />
                }
                buttonText={
                    <FormattedMessage
                        id='test2'
                        defaultMessage='Button Text'
                    />
                }
                saveNeeded={false}
                saveConfigAction={saveConfigActionSuccess}
            />,
        );

        fireEvent.click(screen.getByRole('button', {name: 'Button Text'}));

        expect(requestActionSuccess).toHaveBeenCalledTimes(1);
        expect(saveConfigActionSuccess).not.toHaveBeenCalled();
    });

    test('should show success message when request succeeds and showSuccessMessage is true', () => {
        const requestActionSuccess = jest.fn((success) => success());

        renderWithContext(
            <RequestButton
                requestAction={requestActionSuccess}
                helpText={
                    <FormattedMessage
                        id='test1'
                        defaultMessage='Help Text'
                    />
                }
                buttonText={
                    <FormattedMessage
                        id='test2'
                        defaultMessage='Button Text'
                    />
                }
                showSuccessMessage={true}
                successMessage={{
                    id: 'success.message',
                    defaultMessage: 'Success Message',
                }}
            />,
        );

        fireEvent.click(screen.getByRole('button', {name: 'Button Text'}));
        expect(screen.getByText('Success Message')).toBeInTheDocument();
    });

    test('should not show success message when showSuccessMessage is false', () => {
        const requestActionSuccess = jest.fn((success) => success());

        renderWithContext(
            <RequestButton
                requestAction={requestActionSuccess}
                helpText={
                    <FormattedMessage
                        id='test1'
                        defaultMessage='Help Text'
                    />
                }
                buttonText={
                    <FormattedMessage
                        id='test2'
                        defaultMessage='Button Text'
                    />
                }
                showSuccessMessage={false}
                successMessage={{
                    id: 'success.message',
                    defaultMessage: 'Success Message',
                }}
            />,
        );

        fireEvent.click(screen.getByRole('button', {name: 'Button Text'}));
        expect(screen.queryByText('Success Message')).not.toBeInTheDocument();
    });

    test('should show error message with detailed error when request fails and includeDetailedError is true', () => {
        const requestActionFailure = jest.fn((success, error) => error({
            message: '__message__',
            detailed_error: '__detailed_error__',
        }));

        renderWithContext(
            <RequestButton
                requestAction={requestActionFailure}
                helpText={
                    <FormattedMessage
                        id='test1'
                        defaultMessage='Help Text'
                    />
                }
                buttonText={
                    <FormattedMessage
                        id='test2'
                        defaultMessage='Button Text'
                    />
                }
                includeDetailedError={true}
                errorMessage={{
                    id: 'error.message',
                    defaultMessage: 'Error Message: {error}',
                }}
            />,
        );

        fireEvent.click(screen.getByRole('button', {name: 'Button Text'}));
        expect(screen.getByText('Error Message: __message__ - __detailed_error__')).toBeInTheDocument();
    });

    test('should show error message without detailed error when includeDetailedError is false', () => {
        const requestActionFailure = jest.fn((success, error) => error({
            message: '__message__',
            detailed_error: '__detailed_error__',
        }));

        renderWithContext(
            <RequestButton
                requestAction={requestActionFailure}
                helpText={
                    <FormattedMessage
                        id='test1'
                        defaultMessage='Help Text'
                    />
                }
                buttonText={
                    <FormattedMessage
                        id='test2'
                        defaultMessage='Button Text'
                    />
                }
                errorMessage={{
                    id: 'error.message',
                    defaultMessage: 'Error Message: {error}',
                }}
            />,
        );

        fireEvent.click(screen.getByRole('button', {name: 'Button Text'}));
        expect(screen.getByText('Error Message: __message__')).toBeInTheDocument();
    });
});
