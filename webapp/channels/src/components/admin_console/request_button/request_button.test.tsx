// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import RequestButton from 'components/admin_console/request_button/request_button';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

describe('components/admin_console/request_button/request_button.jsx', () => {
    test('should match snapshot', () => {
        const emptyFunction = jest.fn();

        const {container} = renderWithContext(
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
        expect(container).toMatchSnapshot();
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

    test('should match snapshot with successMessage', async () => {
        const requestActionSuccess = jest.fn((success) => success());

        // Success & showSuccessMessage=true
        const {container: container1} = renderWithContext(
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
        expect(container1).toMatchSnapshot();

        // Success & showSuccessMessage=false
        const {container: container2} = renderWithContext(
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

        expect(container2).toMatchSnapshot();
    });

    test('should match snapshot with request error', async () => {
        const requestActionFailure = jest.fn((success, error) => error({
            message: '__message__',
            detailed_error: '__detailed_error__',
        }));

        // Error & includeDetailedError=true
        const {container: container1} = renderWithContext(
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
        expect(container1).toMatchSnapshot();

        // Error & includeDetailedError=false
        const {container: container2} = renderWithContext(
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

        expect(container2).toMatchSnapshot();
    });
});
