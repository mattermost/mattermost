// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';
import {FormattedMessage} from 'react-intl';

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

    const warningMessage = (
        <FormattedMessage
            defaultMessage='All current guest account sessions will be revoked, and marked as inactive'
            id='admin.guest_access.disableConfirmWarning'
        />
    );

    describe('initial state', () => {
        test('with true', () => {
            const props = {
                ...baseProps,
                value: true,
            };

            const wrapper = shallow(
                <CustomEnableDisableGuestAccountsSetting {...props}/>,
            );
            expect(wrapper).toMatchSnapshot();
        });

        test('with false', () => {
            const props = {
                ...baseProps,
                value: false,
            };

            const wrapper = shallow(
                <CustomEnableDisableGuestAccountsSetting {...props}/>,
            );
            expect(wrapper).toMatchSnapshot();
        });
    });

    describe('handleChange', () => {
        test('should enable without show confirmation modal or warning', () => {
            const props = {
                ...baseProps,
                showConfirm: true,
                onChange: jest.fn(),
            };

            const wrapper = shallow<CustomEnableDisableGuestAccountsSetting>(
                <CustomEnableDisableGuestAccountsSetting {...props}/>,
            );

            wrapper.instance().handleChange('MySetting', true);
            expect(props.onChange).toBeCalledWith(baseProps.id, true, false, false, '');
        });

        test('should show confirmation modal and warning when disabling', () => {
            const props = {
                ...baseProps,
                showConfirm: true,
                onChange: jest.fn(),
            };

            const wrapper = shallow<CustomEnableDisableGuestAccountsSetting>(
                <CustomEnableDisableGuestAccountsSetting {...props}/>,
            );

            wrapper.instance().handleChange('MySetting', false);
            expect(props.onChange).toBeCalledWith(baseProps.id, false, true, false, warningMessage);
        });

        test('should call onChange with doSubmit = true when confirm is true', () => {
            const props = {
                ...baseProps,
                onChange: jest.fn(),
                showConfirm: true,
            };

            const wrapper = shallow<CustomEnableDisableGuestAccountsSetting>(
                <CustomEnableDisableGuestAccountsSetting {...props}/>,
            );

            wrapper.instance().handleChange('MySetting', false, true);
            expect(props.onChange).toBeCalledWith(baseProps.id, false, true, true, warningMessage);
        });
    });
});
