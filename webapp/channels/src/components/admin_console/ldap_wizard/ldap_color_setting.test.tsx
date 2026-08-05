// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {defineMessage} from 'react-intl';

import {fireEvent, renderWithContext, screen} from 'tests/react_testing_utils';

import LDAPColorSetting from './ldap_color_setting';

import type {AdminDefinitionSubSectionSchema} from '../types';

describe('components/admin_console/ldap_wizard/LDAPColorSetting', () => {
    const schema = {id: 'LdapSettings'} as AdminDefinitionSubSectionSchema;

    const colorSetting = {
        type: 'color' as const,
        key: 'LdapSettings.LoginButtonTextColor',
        label: defineMessage({id: 'admin.ldap.loginButtonTextColor.title', defaultMessage: 'AD/LDAP Login Button Text Color:'}),
        help_text: defineMessage({id: 'admin.ldap.loginButtonTextColor.desc', defaultMessage: 'Specify the color of the AD/LDAP login button text.'}),
    };

    test('renders a color input for a color setting', () => {
        renderWithContext(
            <LDAPColorSetting
                schema={schema}
                setting={colorSetting}
                value='#2389D7'
                disabled={false}
                onChange={jest.fn()}
            />,
        );

        const input = screen.getByTestId('color-inputColorValue');
        expect(input).toBeInTheDocument();
        expect(input).toHaveValue('#2389D7');
        expect(input).not.toBeDisabled();
        expect(screen.getByText('AD/LDAP Login Button Text Color:')).toBeInTheDocument();
    });

    test('forwards changes to onChange with the setting key', () => {
        const onChange = jest.fn();

        renderWithContext(
            <LDAPColorSetting
                schema={schema}
                setting={colorSetting}
                value='#2389D7'
                disabled={false}
                onChange={onChange}
            />,
        );

        fireEvent.change(screen.getByTestId('color-inputColorValue'), {target: {value: '#ff0000'}});

        expect(onChange).toHaveBeenCalledWith('LdapSettings.LoginButtonTextColor', '#ff0000');
    });

    test('disables the color input when disabled', () => {
        renderWithContext(
            <LDAPColorSetting
                schema={schema}
                setting={colorSetting}
                value='#2389D7'
                disabled={true}
                onChange={jest.fn()}
            />,
        );

        expect(screen.getByTestId('color-inputColorValue')).toBeDisabled();
    });

    test('renders nothing for a non-color setting', () => {
        const {container} = renderWithContext(
            <LDAPColorSetting
                schema={schema}
                setting={{type: 'text', key: 'LdapSettings.LoginFieldName', label: defineMessage({id: 'admin.ldap.loginNameTitle', defaultMessage: 'Login Field Name:'})}}
                value=''
                disabled={false}
                onChange={jest.fn()}
            />,
        );

        expect(container).toBeEmptyDOMElement();
    });
});
