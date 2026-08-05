// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {RESOURCE_KEYS} from 'mattermost-redux/constants/permissions_sysconsole';

import AdminDefinition from './admin_definition';
import {ldapWizardAdminDefinition} from './admin_definition_ldap_wizard';
import type {AdminDefinitionSetting} from './types';

type IsDisabledCheck = (
    config: object,
    state: object,
    license: undefined,
    enterpriseReady: undefined,
    consoleAccess: {read?: Record<string, boolean>; write?: Record<string, boolean>},
) => boolean;

describe('AdminDefinition - AD/LDAP login button text color', () => {
    const getLoginButtonSection = () => {
        return ldapWizardAdminDefinition.sections?.find(
            (section) => section.key === 'admin.authentication.ldap.login_button',
        );
    };

    const getExperimentalFeatureSettings = (): AdminDefinitionSetting[] => {
        const featureSection = AdminDefinition.experimental.subsections.experimental_features;
        const settings = 'settings' in featureSection.schema! ? featureSection.schema.settings : undefined;

        return (settings ?? []) as AdminDefinitionSetting[];
    };

    it('adds a dedicated Login Button section to the AD/LDAP page with the text color setting', () => {
        const section = getLoginButtonSection();

        expect(section).toBeDefined();

        const setting = section?.settings.find((s) => s.key === 'LdapSettings.LoginButtonTextColor');

        expect(setting).toBeDefined();
        expect(setting?.type).toBe('color');
        expect((setting?.label as {id?: string})?.id).toBe('admin.ldap.loginButtonTextColorTitle');
        expect((setting?.help_text as {id?: string})?.id).toBe('admin.ldap.loginButtonTextColorDesc');
    });

    it('removes only the text color from the Experimental Features page', () => {
        const keys = getExperimentalFeatureSettings().map((s) => s.key);

        expect(keys).not.toContain('LdapSettings.LoginButtonTextColor');

        // The sibling colors are moved by separate tickets and must stay put.
        expect(keys).toContain('LdapSettings.LoginButtonColor');
        expect(keys).toContain('LdapSettings.LoginButtonBorderColor');
    });

    describe('is governed by AD/LDAP write permission', () => {
        const getIsDisabled = () => {
            const setting = getLoginButtonSection()?.settings.find((s) => s.key === 'LdapSettings.LoginButtonTextColor');
            return setting?.isDisabled as IsDisabledCheck;
        };

        it('disables the setting without AD/LDAP write permission', () => {
            const disabled = getIsDisabled()({}, {}, undefined, undefined, {write: {}});

            expect(disabled).toBe(true);
        });

        it('enables the setting with AD/LDAP write permission', () => {
            const disabled = getIsDisabled()({}, {}, undefined, undefined, {
                write: {[RESOURCE_KEYS.AUTHENTICATION.LDAP]: true},
            });

            expect(disabled).toBe(false);
        });
    });
});
