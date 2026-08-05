// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {defineMessage} from 'react-intl';

import {fireEvent, renderWithContext, screen} from 'tests/react_testing_utils';

import LDAPColorSetting from './ldap_color_setting';

import type {AdminDefinitionSetting, AdminDefinitionSubSectionSchema} from '../types';

const schema: AdminDefinitionSubSectionSchema = {
    id: 'LdapSettings',
    name: 'AD/LDAP',
};

const setting: AdminDefinitionSetting = {
    type: 'color',
    key: 'LdapSettings.LoginButtonBorderColor',
    label: defineMessage({id: 'admin.ldap.loginButtonBorderColorTitle', defaultMessage: 'AD/LDAP Login Button Border Color:'}),
    help_text: defineMessage({id: 'admin.ldap.loginButtonBorderColorDesc', defaultMessage: 'Specify the color of the AD/LDAP login button border for white labeling purposes.'}),
    help_text_markdown: false,
};

describe('components/admin_console/ldap_wizard/LDAPColorSetting', () => {
    test('renders the label, help text and current color value', () => {
        renderWithContext(
            <LDAPColorSetting
                schema={schema}
                setting={setting}
                value='#FF0000'
                disabled={false}
                onChange={jest.fn()}
            />,
        );

        expect(screen.getByText('AD/LDAP Login Button Border Color:')).toBeInTheDocument();
        expect(screen.getByText('Specify the color of the AD/LDAP login button border for white labeling purposes.')).toBeInTheDocument();
        expect(screen.getByTestId('color-inputColorValue')).toHaveValue('#FF0000');
    });

    test('calls onChange with the setting key and normalized color when the value changes', () => {
        const onChange = jest.fn();
        renderWithContext(
            <LDAPColorSetting
                schema={schema}
                setting={setting}
                value='#FF0000'
                disabled={false}
                onChange={onChange}
            />,
        );

        fireEvent.change(screen.getByTestId('color-inputColorValue'), {target: {value: '#00ff00'}});

        expect(onChange).toHaveBeenCalledWith('LdapSettings.LoginButtonBorderColor', '#00ff00');
    });

    test('disables the color input when disabled', () => {
        renderWithContext(
            <LDAPColorSetting
                schema={schema}
                setting={setting}
                value='#FF0000'
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
                setting={{...setting, type: 'text'}}
                value='#FF0000'
                disabled={false}
                onChange={jest.fn()}
            />,
        );

        expect(container).toBeEmptyDOMElement();
    });
});
