// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {RESOURCE_KEYS} from 'mattermost-redux/constants/permissions_sysconsole';

import AdminDefinition from './admin_definition';
import {ldapWizardAdminDefinition} from './admin_definition_ldap_wizard';
import type {AdminDefinitionSetting} from './types';

const LOGIN_BUTTON_COLOR_SETTINGS = [
    {key: 'LdapSettings.LoginButtonColor', labelId: 'admin.ldap.loginButtonColor.title', helpId: 'admin.ldap.loginButtonColor.desc'},
    {key: 'LdapSettings.LoginButtonBorderColor', labelId: 'admin.ldap.loginButtonBorderColor.title', helpId: 'admin.ldap.loginButtonBorderColor.desc'},
    {key: 'LdapSettings.LoginButtonTextColor', labelId: 'admin.ldap.loginButtonTextColor.title', helpId: 'admin.ldap.loginButtonTextColor.desc'},
];

const LOGIN_BUTTON_COLOR_KEYS = LOGIN_BUTTON_COLOR_SETTINGS.map((s) => s.key);

type IsDisabledCheck = (
    config: object,
    state: object,
    license: undefined,
    enterpriseReady: undefined,
    consoleAccess: {read?: Record<string, boolean>; write?: Record<string, boolean>},
) => boolean;

describe('AdminDefinition - AD/LDAP login button colors', () => {
    const getLdapConnectionSettings = (): AdminDefinitionSetting[] => {
        const connectionSection = ldapWizardAdminDefinition.sections?.find(
            (section) => section.key === 'admin.authentication.ldap.connection',
        );

        return (connectionSection?.settings ?? []) as AdminDefinitionSetting[];
    };

    const getExperimentalFeatureSettings = (): AdminDefinitionSetting[] => {
        const featureSection = AdminDefinition.experimental.subsections.experimental_features;
        const settings = 'settings' in featureSection.schema! ? featureSection.schema.settings : undefined;

        return (settings ?? []) as AdminDefinitionSetting[];
    };

    it.each(LOGIN_BUTTON_COLOR_SETTINGS)('defines $key as a color setting on the AD/LDAP page', ({key, labelId, helpId}) => {
        const setting = getLdapConnectionSettings().find((s) => s.key === key);

        expect(setting).toBeDefined();
        expect(setting?.type).toBe('color');

        // Assert the exact message ids so a copy/paste mistake between the three
        // colors (or a leftover admin.experimental.* id) is caught.
        expect((setting?.label as {id?: string})?.id).toBe(labelId);
        expect((setting?.help_text as {id?: string})?.id).toBe(helpId);
    });

    it.each(LOGIN_BUTTON_COLOR_KEYS)('no longer exposes %s on the Experimental Features page', (key) => {
        const setting = getExperimentalFeatureSettings().find((s) => s.key === key);

        expect(setting).toBeUndefined();
    });

    describe('are governed by AD/LDAP write permission', () => {
        const enabledState = {'LdapSettings.Enable': true, 'LdapSettings.EnableSync': true};

        it.each(LOGIN_BUTTON_COLOR_KEYS)('disables %s without AD/LDAP write permission', (key) => {
            const setting = getLdapConnectionSettings().find((s) => s.key === key);
            const isDisabled = setting?.isDisabled as IsDisabledCheck;

            const disabled = isDisabled({}, enabledState, undefined, undefined, {write: {}});

            expect(disabled).toBe(true);
        });

        it.each(LOGIN_BUTTON_COLOR_KEYS)('enables %s with AD/LDAP write permission when AD/LDAP is enabled', (key) => {
            const setting = getLdapConnectionSettings().find((s) => s.key === key);
            const isDisabled = setting?.isDisabled as IsDisabledCheck;

            const disabled = isDisabled({}, enabledState, undefined, undefined, {
                write: {[RESOURCE_KEYS.AUTHENTICATION.LDAP]: true},
            });

            expect(disabled).toBe(false);
        });

        it.each(LOGIN_BUTTON_COLOR_KEYS)('disables %s when AD/LDAP sign-in and sync are both off', (key) => {
            const setting = getLdapConnectionSettings().find((s) => s.key === key);
            const isDisabled = setting?.isDisabled as IsDisabledCheck;

            const disabled = isDisabled(
                {},
                {'LdapSettings.Enable': false, 'LdapSettings.EnableSync': false},
                undefined,
                undefined,
                {write: {[RESOURCE_KEYS.AUTHENTICATION.LDAP]: true}},
            );

            expect(disabled).toBe(true);
        });
    });
});
