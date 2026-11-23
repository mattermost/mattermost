// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {AdminConfig, ClientLicense} from '@mattermost/types/config';

import {RESOURCE_KEYS} from 'mattermost-redux/constants/permissions_sysconsole';

import {LicenseSkus} from 'utils/constants';

import AdminDefinition from './admin_definition';
import type {AdminDefinitionSetting, Check, ConsoleAccess} from './types';

const passkeys = AdminDefinition.authentication.subsections.passkeys;

const license = (sku?: string) => (sku ? {IsLicensed: 'true', SkuShortName: sku} : {IsLicensed: 'false'}) as ClientLicense;
const access = (read: boolean, write: boolean) => ({
    read: {[RESOURCE_KEYS.AUTHENTICATION.MFA]: read},
    write: {[RESOURCE_KEYS.AUTHENTICATION.MFA]: write},
} as ConsoleAccess);

function isHidden(sku: string | undefined, flag = true, consoleAccess = access(true, true)) {
    const check = passkeys.isHidden as Exclude<Check, boolean>;
    return check({FeatureFlags: {Passkeys: flag}}, {}, license(sku), true, consoleAccess);
}

function isDisabled(setting: AdminDefinitionSetting, consoleAccess: ConsoleAccess) {
    const check = setting.isDisabled as Exclude<Check, boolean>;
    return check({}, {}, license(LicenseSkus.Professional), true, consoleAccess);
}

const settings = () => (passkeys.schema && 'settings' in passkeys.schema ? passkeys.schema.settings : []) as AdminDefinitionSetting[];
const setting = (key: string) => settings().find((s) => s.key === key)!;

describe('AdminDefinition - Passkeys', () => {
    test('is registered under Authentication at authentication/passkeys', () => {
        expect(passkeys.url).toBe('authentication/passkeys');
    });

    test('is shown with the flag on, a Professional or higher license and read permission', () => {
        for (const sku of [LicenseSkus.Professional, LicenseSkus.Enterprise, LicenseSkus.EnterpriseAdvanced, LicenseSkus.Entry]) {
            expect(isHidden(sku)).toBe(false);
        }
    });

    test('is hidden when the feature flag is off', () => {
        expect(isHidden(LicenseSkus.Enterprise, false)).toBe(true);
    });

    test('is hidden below a Professional license', () => {
        expect(isHidden(LicenseSkus.Starter)).toBe(true);
        expect(isHidden(undefined)).toBe(true);
    });

    test('is hidden without read permission', () => {
        expect(isHidden(LicenseSkus.Enterprise, true, access(false, false))).toBe(true);
    });

    test('has an info banner first', () => {
        expect(settings()[0].type).toBe('banner');
        expect((settings()[0] as {banner_type?: string}).banner_type).toBe('info');
    });

    test.each(['ServiceSettings.EnablePasskeyEnrollment', 'ServiceSettings.EnablePasskeyLogin'])('%s is a bool disabled without write permission only', (key) => {
        const s = setting(key);
        expect(s.type).toBe('bool');
        expect(isDisabled(s, access(true, false))).toBe(true);
        expect(isDisabled(s, access(true, true))).toBe(false);
    });
});

describe('AdminDefinition - Site URL passkey warning', () => {
    const webServer = AdminDefinition.environment.subsections.web_server.schema as {settings: AdminDefinitionSetting[]};
    const banner = webServer.settings.find(
        (s) => s.type === 'banner' && 'label' in s && (s.label as {id: string}).id === 'admin.service.siteURLPasskeyWarning',
    ) as AdminDefinitionSetting;

    function hidden(saved: string, edited: string | undefined, sku: string | undefined = LicenseSkus.Professional, flag = true) {
        const check = banner.isHidden as Exclude<Check, boolean>;
        return check({FeatureFlags: {Passkeys: flag}, ServiceSettings: {SiteURL: saved}} as unknown as Partial<AdminConfig>, {'ServiceSettings.SiteURL': edited}, license(sku));
    }

    test('is a warning banner', () => {
        expect((banner as {banner_type?: string}).banner_type).toBe('warning');
    });

    test('shows when the host changes', () => {
        expect(hidden('https://chat.example.com', 'https://mm.example.com')).toBe(false);
    });

    test.each([
        'https://chat.example.com',
        'https://chat.example.com:8443/mm',
        'http://chat.example.com',
        'https://CHAT.example.com',
    ])('stays hidden when %s differs only by scheme, port, path or case', (edited) => {
        expect(hidden('https://chat.example.com', edited)).toBe(true);
    });

    test('stays hidden when the saved URL is empty', () => {
        expect(hidden('', 'https://mm.example.com')).toBe(true);
    });

    test.each(['', undefined, 'not a url', 'https://'])('stays hidden for edited value %p', (edited) => {
        expect(hidden('https://chat.example.com', edited)).toBe(true);
    });

    test('is hidden when the flag is off or the license is below Professional', () => {
        expect(hidden('https://chat.example.com', 'https://mm.example.com', LicenseSkus.Professional, false)).toBe(true);
        expect(hidden('https://chat.example.com', 'https://mm.example.com', LicenseSkus.Starter)).toBe(true);
        expect(hidden('https://chat.example.com', 'https://mm.example.com', '')).toBe(true);
    });
});
