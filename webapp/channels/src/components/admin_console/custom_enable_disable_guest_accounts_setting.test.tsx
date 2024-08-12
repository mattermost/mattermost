// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {render, fireEvent, screen} from '@testing-library/react';
import React from 'react';
import {FormattedMessage, IntlProvider} from 'react-intl';
import {Provider} from 'react-redux';

import store from 'stores/redux_store';

import CustomEnableDisableGuestAccountsSetting from './custom_enable_disable_guest_accounts_setting';

describe('components/AdminConsole/CustomEnableDisableGuestAccountsSetting', () => {
    const baseProps = {
        id: 'MySetting',
        value: false,
        onChange: jest.fn(),
        cancelSubmit: jest.fn(),
        disabled: false,
        setByEnv: false,
        showConfirm: false,
    };

    const intlProviderProps = {
        defaultLocale: 'en',
        locale: 'en',
    };

    const renderComponent = (props = {}) => {
        return render(
            <IntlProvider {...intlProviderProps}>
                <Provider store={store}>
                    <CustomEnableDisableGuestAccountsSetting
                        {...baseProps}
                        {...props}
                    />
                </Provider>
            </IntlProvider>);
    };

    const warningMessage = (
        <FormattedMessage
            defaultMessage='All current guest account sessions will be revoked, and marked as inactive'
            id='admin.guest_access.disableConfirmWarning'
        />
    );

    describe('renders correctly', () => {
        test('when enabled', () => {
            const wrapper = renderComponent({value: true});
            expect(wrapper).toMatchSnapshot();
        });

        test('when disabled', () => {
            const wrapper = renderComponent({value: false});
            expect(wrapper).toMatchSnapshot();
        });
    });

    describe('handleChange', () => {
        test('should enable without show confirmation modal or warning', () => {
            const props = {
                showConfirm: true,
                onChange: jest.fn(),
            };

            renderComponent(props);

            const trueRadio = screen.getByTestId('MySettingtrue');
            fireEvent.click(trueRadio);

            expect(props.onChange).toHaveBeenCalledWith(baseProps.id, true, false, false, '');
        });

        test('should show confirmation modal and warning when disabling', () => {
            const props = {
                value: true,
                showConfirm: true,
                onChange: jest.fn(),
            };

            renderComponent(props);

            const falseRadio = screen.getByTestId('MySettingfalse');
            fireEvent.click(falseRadio);

            expect(props.onChange).toHaveBeenCalledWith(baseProps.id, false, true, false, warningMessage);
        });

        test('should call onChange with doSubmit = true when confirm is true', () => {
            const props = {
                ...baseProps,
                onChange: jest.fn(),
                showConfirm: true,
            };

            renderComponent(props);

            const falseRadio = screen.getByTestId('MySettingfalse');
            fireEvent.click(falseRadio);

            const confirmButton = screen.getByText('Save and Disable Guest Access');
            fireEvent.click(confirmButton);

            expect(props.onChange).toHaveBeenCalledWith(baseProps.id, false, true, true, warningMessage);
        });
    });
});
