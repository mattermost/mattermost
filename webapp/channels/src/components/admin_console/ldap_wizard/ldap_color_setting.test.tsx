// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {fireEvent, renderWithContext, screen} from 'tests/react_testing_utils';

import LDAPColorSetting from './ldap_color_setting';
import type {GeneralSettingProps} from './ldap_wizard';

import type {AdminDefinitionSetting, AdminDefinitionSubSectionSchema} from '../types';

const schema = {id: 'LdapSettings'} as AdminDefinitionSubSectionSchema;

const colorSetting: AdminDefinitionSetting = {
    type: 'color',
    key: 'LdapSettings.LoginButtonColor',
    label: {id: 'admin.ldap.loginButtonColorTitle', defaultMessage: 'AD/LDAP Login Button Color:'},
    help_text: {id: 'admin.ldap.loginButtonColorDesc', defaultMessage: 'Specify the color of the AD/LDAP login button.'},
} as AdminDefinitionSetting;

const baseProps = {
    setting: colorSetting as GeneralSettingProps['setting'],
    schema,
    value: '#4578ff',
    disabled: false,
    setByEnv: false,
    onChange: jest.fn(),
};

describe('components/admin_console/ldap_wizard/LDAPColorSetting', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('renders the label, help text, and color input with the provided value', () => {
        renderWithContext(<LDAPColorSetting {...baseProps}/>);

        expect(screen.getByText('AD/LDAP Login Button Color:')).toBeInTheDocument();
        expect(screen.getByText('Specify the color of the AD/LDAP login button.')).toBeInTheDocument();

        const input = screen.getByTestId('color-inputColorValue');
        expect(input).toHaveValue('#4578ff');
        expect(input).not.toBeDisabled();
    });

    test('invokes onChange with the setting key and the normalized (lower-cased) color when edited', () => {
        renderWithContext(<LDAPColorSetting {...baseProps}/>);

        fireEvent.change(screen.getByTestId('color-inputColorValue'), {target: {value: '#ABCABC'}});

        expect(baseProps.onChange).toHaveBeenCalledWith('LdapSettings.LoginButtonColor', '#abcabc');
    });

    test('does not invoke onChange when the entered value is not a valid color', () => {
        renderWithContext(<LDAPColorSetting {...baseProps}/>);

        fireEvent.change(screen.getByTestId('color-inputColorValue'), {target: {value: 'not-a-color'}});

        expect(baseProps.onChange).not.toHaveBeenCalled();
    });

    test('disables the color input when disabled', () => {
        renderWithContext(
            <LDAPColorSetting
                {...baseProps}
                disabled={true}
            />,
        );

        expect(screen.getByTestId('color-inputColorValue')).toBeDisabled();
    });

    test('disables the color input and shows the env notice when setByEnv', () => {
        renderWithContext(
            <LDAPColorSetting
                {...baseProps}
                setByEnv={true}
            />,
        );

        expect(screen.getByTestId('color-inputColorValue')).toBeDisabled();
        expect(screen.getByText(/This setting has been set through an environment variable/)).toBeInTheDocument();
    });

    test('renders the LDAP-specific "More Info" hover affordance when help_text_more_info is set', () => {
        renderWithContext(
            <LDAPColorSetting
                {...baseProps}
                setting={{
                    ...colorSetting,
                    help_text_more_info: {id: 'test.moreInfo', defaultMessage: 'Extra guidance about the button color.'},
                } as GeneralSettingProps['setting']}
            />,
        );

        expect(screen.getByText('Specify the color of the AD/LDAP login button.')).toBeInTheDocument();
        expect(screen.getByRole('button', {name: 'More Info'})).toBeInTheDocument();
    });

    test('renders nothing when the setting is not a color type', () => {
        const {container} = renderWithContext(
            <LDAPColorSetting
                {...baseProps}
                setting={{...colorSetting, type: 'text'} as GeneralSettingProps['setting']}
            />,
        );

        expect(container).toBeEmptyDOMElement();
    });

    test('renders nothing when the schema is missing', () => {
        const {container} = renderWithContext(
            <LDAPColorSetting
                {...baseProps}
                schema={null}
            />,
        );

        expect(container).toBeEmptyDOMElement();
    });

    test('renders nothing when the setting has no key', () => {
        const {container} = renderWithContext(
            <LDAPColorSetting
                {...baseProps}
                setting={{...colorSetting, key: undefined} as GeneralSettingProps['setting']}
            />,
        );

        expect(container).toBeEmptyDOMElement();
    });
});
