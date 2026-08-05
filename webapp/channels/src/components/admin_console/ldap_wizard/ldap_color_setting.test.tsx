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
    onChange: jest.fn(),
};

describe('components/admin_console/ldap_wizard/LDAPColorSetting', () => {
    test('renders the label, help text, and color input with the provided value', () => {
        renderWithContext(<LDAPColorSetting {...baseProps}/>);

        expect(screen.getByText('AD/LDAP Login Button Color:')).toBeInTheDocument();
        expect(screen.getByText('Specify the color of the AD/LDAP login button.')).toBeInTheDocument();

        const input = screen.getByTestId('color-inputColorValue');
        expect(input).toHaveValue('#4578ff');
        expect(input).not.toBeDisabled();
    });

    test('invokes onChange with the setting key and the normalized color when edited', () => {
        const onChange = jest.fn();
        renderWithContext(
            <LDAPColorSetting
                {...baseProps}
                onChange={onChange}
            />,
        );

        fireEvent.change(screen.getByTestId('color-inputColorValue'), {target: {value: '#ff0000'}});

        expect(onChange).toHaveBeenCalledWith('LdapSettings.LoginButtonColor', '#ff0000');
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

    test('renders nothing when the setting is not a color type', () => {
        const {container} = renderWithContext(
            <LDAPColorSetting
                {...baseProps}
                setting={{...colorSetting, type: 'text'} as GeneralSettingProps['setting']}
            />,
        );

        expect(container).toBeEmptyDOMElement();
    });
});
