// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {defineMessage} from 'react-intl';

import {fireEvent, renderWithContext, screen} from 'tests/react_testing_utils';

import LDAPColorSetting from './ldap_color_setting';
import type {LDAPDefinitionSetting} from './ldap_wizard';

import type {AdminDefinitionSubSectionSchema} from '../types';

const schema: AdminDefinitionSubSectionSchema = {
    id: 'LdapSettings',
    name: 'AD/LDAP',
};

const setting: LDAPDefinitionSetting = {
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

    test('calls onChange with the setting key and a normalized hex color when the value changes', () => {
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

        // A shorthand, upper-case value must be normalized to a full lower-case hex.
        fireEvent.change(screen.getByTestId('color-inputColorValue'), {target: {value: '#0F0'}});

        expect(onChange).toHaveBeenCalledWith('LdapSettings.LoginButtonBorderColor', '#00ff00');
    });

    test('does not call onChange when the entered value is not a valid color', () => {
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

        fireEvent.change(screen.getByTestId('color-inputColorValue'), {target: {value: 'not-a-color'}});

        expect(onChange).not.toHaveBeenCalled();
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

    test('renders the LDAP "More Info" hover help when help_text_more_info is set', () => {
        renderWithContext(
            <LDAPColorSetting
                schema={schema}
                setting={{...setting, help_text_more_info: 'Additional guidance about the border color.'}}
                value='#FF0000'
                disabled={false}
                onChange={jest.fn()}
            />,
        );

        expect(screen.getByText('Specify the color of the AD/LDAP login button border for white labeling purposes.')).toBeInTheDocument();
        expect(screen.getByRole('button', {name: 'More Info'})).toBeInTheDocument();
    });

    test('renders the disabled help text instead of the default when disabled', () => {
        renderWithContext(
            <LDAPColorSetting
                schema={schema}
                setting={{...setting, disabled_help_text: 'This setting is managed elsewhere.'}}
                value='#FF0000'
                disabled={true}
                onChange={jest.fn()}
            />,
        );

        expect(screen.getByText('This setting is managed elsewhere.')).toBeInTheDocument();
        expect(screen.queryByText('Specify the color of the AD/LDAP login button border for white labeling purposes.')).not.toBeInTheDocument();
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

    test('renders nothing when the setting has no key', () => {
        const {container} = renderWithContext(
            <LDAPColorSetting
                schema={schema}
                setting={{...setting, key: undefined}}
                value='#FF0000'
                disabled={false}
                onChange={jest.fn()}
            />,
        );

        expect(container).toBeEmptyDOMElement();
    });

    test('renders nothing when there is no schema', () => {
        const {container} = renderWithContext(
            <LDAPColorSetting
                schema={null}
                setting={setting}
                value='#FF0000'
                disabled={false}
                onChange={jest.fn()}
            />,
        );

        expect(container).toBeEmptyDOMElement();
    });
});
