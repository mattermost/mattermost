// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {fireEvent, screen} from '@testing-library/react';
import React from 'react';
import {FormattedMessage} from 'react-intl';

import {renderWithContext} from 'tests/react_testing_utils';

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

    describe('renders correctly', () => {
        test('when enabled', () => {
            const {container} = renderWithContext(
                <CustomEnableDisableGuestAccountsSetting
                    {...baseProps}
                    value={true}
                />,
            );
            expect(container).toMatchSnapshot();
        });

        test('when disabled', () => {
            const {container} = renderWithContext(
                <CustomEnableDisableGuestAccountsSetting
                    {...baseProps}
                    value={false}
                />,
            );
            expect(container).toMatchSnapshot();
        });
    });

    describe('handleChange', () => {
        test('should enable without show confirmation modal or warning', () => {
            const props = {
                showConfirm: true,
                onChange: jest.fn(),
            };

            renderWithContext(
                <CustomEnableDisableGuestAccountsSetting
                    {...baseProps}
                    {...props}
                />,
            );

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

            renderWithContext(
                <CustomEnableDisableGuestAccountsSetting
                    {...baseProps}
                    {...props}
                />,
            );

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

            renderWithContext(
                <CustomEnableDisableGuestAccountsSetting
                    {...props}
                />,
            );

            const falseRadio = screen.getByTestId('MySettingfalse');
            fireEvent.click(falseRadio);

            const confirmButton = screen.getByText('Save and Disable Guest Access');
            fireEvent.click(confirmButton);

            expect(props.onChange).toHaveBeenCalledWith(baseProps.id, false, true, true, warningMessage);
        });
    });
});
