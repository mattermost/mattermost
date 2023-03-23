// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';
import {shallow} from 'enzyme';

import RequestButton from 'components/admin_console/request_button/request_button';

import {mountWithIntl} from 'tests/helpers/intl-test-helper';

describe('components/admin_console/request_button/request_button.jsx', () => {
    test('should match snapshot', () => {
        const emptyFunction = jest.fn();

        const wrapper = shallow<RequestButton>(
            <RequestButton
                requestAction={emptyFunction}
                helpText={
                    <FormattedMessage
                        id='test'
                        defaultMessage='Help Text'
                    />
                }
                buttonText={
                    <FormattedMessage
                        id='test'
                        defaultMessage='Button Text'
                    />
                }
            />,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should call saveConfig and request actions when saveNeeded is true', () => {
        const requestActionSuccess = jest.fn((success) => success());
        const saveConfigActionSuccess = jest.fn((success) => success());

        const wrapper = mountWithIntl(
            <RequestButton
                requestAction={requestActionSuccess}
                helpText={
                    <FormattedMessage
                        id='test'
                        defaultMessage='Help Text'
                    />
                }
                buttonText={
                    <FormattedMessage
                        id='test'
                        defaultMessage='Button Text'
                    />
                }
                saveNeeded={false}
                saveConfigAction={saveConfigActionSuccess}
            />,
        );

        wrapper.find('button').first().simulate('click');

        expect(requestActionSuccess.mock.calls.length).toBe(1);
        expect(saveConfigActionSuccess.mock.calls.length).toBe(0);
    });

    test('should call only request action when saveNeeded is false', () => {
        const requestActionSuccess = jest.fn((success) => success());
        const saveConfigActionSuccess = jest.fn((success) => success());

        const wrapper = mountWithIntl(
            <RequestButton
                requestAction={requestActionSuccess}
                helpText={
                    <FormattedMessage
                        id='test'
                        defaultMessage='Help Text'
                    />
                }
                buttonText={
                    <FormattedMessage
                        id='test'
                        defaultMessage='Button Text'
                    />
                }
                saveNeeded={true}
                saveConfigAction={saveConfigActionSuccess}
            />,
        );

        wrapper.find('button').first().simulate('click');

        expect(requestActionSuccess.mock.calls.length).toBe(1);
        expect(saveConfigActionSuccess.mock.calls.length).toBe(1);
    });

    test('should match snapshot with successMessage', () => {
        const requestActionSuccess = jest.fn((success) => success());

        // Success & showSuccessMessage=true
        const wrapper1 = mountWithIntl(
            <RequestButton
                requestAction={requestActionSuccess}
                helpText={
                    <FormattedMessage
                        id='test'
                        defaultMessage='Help Text'
                    />
                }
                buttonText={
                    <FormattedMessage
                        id='test'
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

        wrapper1.find('button').first().simulate('click');
        expect(wrapper1).toMatchSnapshot();

        // Success & showSuccessMessage=false
        const wrapper2 = mountWithIntl(
            <RequestButton
                requestAction={requestActionSuccess}
                helpText={
                    <FormattedMessage
                        id='test'
                        defaultMessage='Help Text'
                    />
                }
                buttonText={
                    <FormattedMessage
                        id='test'
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

        wrapper2.find('button').first().simulate('click');

        expect(wrapper2).toMatchSnapshot();
    });

    test('should match snapshot with request error', () => {
        const requestActionFailure = jest.fn((success, error) => error({
            message: '__message__',
            detailed_error: '__detailed_error__',
        }));

        // Error & includeDetailedError=true
        const wrapper1 = mountWithIntl(
            <RequestButton
                requestAction={requestActionFailure}
                helpText={
                    <FormattedMessage
                        id='test'
                        defaultMessage='Help Text'
                    />
                }
                buttonText={
                    <FormattedMessage
                        id='test'
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

        wrapper1.find('button').first().simulate('click');
        expect(wrapper1).toMatchSnapshot();

        // Error & includeDetailedError=false
        const wrapper2 = mountWithIntl(
            <RequestButton
                requestAction={requestActionFailure}
                helpText={
                    <FormattedMessage
                        id='test'
                        defaultMessage='Help Text'
                    />
                }
                buttonText={
                    <FormattedMessage
                        id='test'
                        defaultMessage='Button Text'
                    />
                }
                errorMessage={{
                    id: 'error.message',
                    defaultMessage: 'Error Message: {error}',
                }}
            />,
        );

        wrapper2.find('button').first().simulate('click');

        expect(wrapper2).toMatchSnapshot();
    });
});
