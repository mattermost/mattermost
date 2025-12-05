// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import {renderWithContext, screen, fireEvent} from 'tests/vitest_react_testing_utils';

import RequestButton from './request_button';

describe('components/admin_console/request_button/request_button.jsx', () => {
    test('should match snapshot', () => {
        const emptyFunction = vi.fn();

        const {baseElement} = renderWithContext(
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
        expect(baseElement).toMatchSnapshot();
    });

    test('should call saveConfig and request actions when saveNeeded is true', () => {
        const requestActionSuccess = vi.fn((success) => success());
        const saveConfigActionSuccess = vi.fn((success) => success());

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

        const button = screen.getByRole('button');
        fireEvent.click(button);

        expect(requestActionSuccess.mock.calls.length).toBe(1);
        expect(saveConfigActionSuccess.mock.calls.length).toBe(0);
    });

    test('should call only request action when saveNeeded is false', () => {
        const requestActionSuccess = vi.fn((success) => success());
        const saveConfigActionSuccess = vi.fn((success) => success());

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

        const button = screen.getByRole('button');
        fireEvent.click(button);

        expect(requestActionSuccess.mock.calls.length).toBe(1);
        expect(saveConfigActionSuccess.mock.calls.length).toBe(1);
    });

    test('should match snapshot with successMessage', () => {
        const requestActionSuccess = vi.fn((success) => success());

        // Success & showSuccessMessage=true
        const {baseElement: baseElement1} = renderWithContext(
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

        fireEvent.click(screen.getByRole('button'));
        expect(baseElement1).toMatchSnapshot();

        // Success & showSuccessMessage=false
        const {baseElement: baseElement2} = renderWithContext(
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

        fireEvent.click(screen.getAllByRole('button')[1]);

        expect(baseElement2).toMatchSnapshot();
    });

    test('should match snapshot with request error', () => {
        const requestActionFailure = vi.fn((success, error) => error({
            message: '__message__',
            detailed_error: '__detailed_error__',
        }));

        // Error & includeDetailedError=true
        const {baseElement: baseElement1} = renderWithContext(
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

        fireEvent.click(screen.getByRole('button'));
        expect(baseElement1).toMatchSnapshot();

        // Error & includeDetailedError=false
        const {baseElement: baseElement2} = renderWithContext(
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

        fireEvent.click(screen.getAllByRole('button')[1]);

        expect(baseElement2).toMatchSnapshot();
    });
});
