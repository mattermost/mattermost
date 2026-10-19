// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {defineMessage} from 'react-intl';

import type {AdminConfig} from '@mattermost/types/config';

import {renderWithContext, screen} from 'tests/react_testing_utils';

import LDAPBooleanSetting from './ldap_boolean_setting';

import {it} from '../admin_definition_helpers';
import type {AdminDefinitionSetting, AdminDefinitionSubSectionSchema} from '../types';

describe('components/admin_console/ldap_wizard/LDAPBooleanSetting', () => {
    const WARNING_TITLE = 'Skipping certificate verification is not recommended for production environments';
    const WARNING_TEXT = 'Mattermost will not validate the server certificate.';

    const schema = {id: 'LdapSettings', name: 'ldap'} as AdminDefinitionSubSectionSchema;

    const buildSetting = (): AdminDefinitionSetting => ({
        key: 'LdapSettings.SkipCertificateVerification',
        label: 'skip-cert-label',
        type: 'bool',
        help_text: 'skip-cert-help-text',
        production_warning: {
            isEnabled: it.stateIsTrue('LdapSettings.SkipCertificateVerification'),
            title: defineMessage({id: 'test.ldap.warning.title', defaultMessage: WARNING_TITLE}),
            text: defineMessage({id: 'test.ldap.warning.text', defaultMessage: WARNING_TEXT}),
        },
    } as unknown as AdminDefinitionSetting);

    const renderSetting = (value: boolean, disabled = false) => renderWithContext(
        <LDAPBooleanSetting
            schema={schema}
            setting={buildSetting()}
            value={value}
            disabled={disabled}
            setByEnv={false}
            onChange={jest.fn()}
            config={{} as Partial<AdminConfig>}
            state={{'LdapSettings.SkipCertificateVerification': value}}
        />,
    );

    test('renders the danger callout when the LDAP bool setting is at its insecure value', () => {
        const {container} = renderSetting(true);

        expect(screen.getByText(WARNING_TITLE)).toBeInTheDocument();
        expect(screen.getByText(WARNING_TEXT)).toBeInTheDocument();
        expect(container.querySelector('.sectionNoticeContainer.danger')).toBeInTheDocument();

        // The normal help text still renders alongside the callout.
        expect(screen.getByText('skip-cert-help-text')).toBeInTheDocument();
    });

    test('does not render the callout at the recommended value', () => {
        const {container} = renderSetting(false);

        expect(screen.queryByText(WARNING_TITLE)).not.toBeInTheDocument();
        expect(container.querySelector('.sectionNoticeContainer.danger')).not.toBeInTheDocument();
        expect(screen.getByText('skip-cert-help-text')).toBeInTheDocument();
    });

    test('does not render the callout when the LDAP setting is disabled', () => {
        const {container} = renderSetting(true, true);

        expect(screen.queryByText(WARNING_TITLE)).not.toBeInTheDocument();
        expect(container.querySelector('.sectionNoticeContainer.danger')).not.toBeInTheDocument();
    });
});
