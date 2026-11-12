// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import RequestButton from 'components/admin_console/request_button/request_button';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

describe('components/admin_console/request_button/request_button.jsx', () => {
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
                saveNeeded={false}
                saveConfigAction={saveConfigActionSuccess}
            />,
        );

        await userEvent.click(screen.getByRole('button'));

        expect(requestActionSuccess.mock.calls.length).toBe(1);
        expect(saveConfigActionSuccess.mock.calls.length).toBe(0);
    });

    test('should call only request action when saveNeeded is false', async () => {
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

        await userEvent.click(screen.getByRole('button'));

        expect(requestActionSuccess.mock.calls.length).toBe(1);
        expect(saveConfigActionSuccess.mock.calls.length).toBe(1);
    });

    test('should render with successMessage', async () => {
        const requestActionSuccess = jest.fn((success) => success());

        // Success & showSuccessMessage=true
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

        await userEvent.click(screen.getAllByRole('button')[0]);
        expect(screen.getByText('Success Message')).toBeInTheDocument();

        // Success & showSuccessMessage=false
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

        await userEvent.click(screen.getAllByRole('button')[1]);
        expect(requestActionSuccess).toHaveBeenCalledTimes(2);
        expect(screen.getAllByText('Success Message')).toHaveLength(1);
    });

    test('should render with request error', async () => {
        const requestActionFailure = jest.fn((success, error) => error({
            message: '__message__',
            detailed_error: '__detailed_error__',
        }));

        // Error & includeDetailedError=true
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

        await userEvent.click(screen.getAllByRole('button')[0]);
        expect(screen.getByText('Error Message: __message__ - __detailed_error__')).toBeInTheDocument();

        // Error & includeDetailedError=false
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

        await userEvent.click(screen.getAllByRole('button')[1]);
        expect(screen.getByText('Error Message: __message__')).toBeInTheDocument();
    });
});
