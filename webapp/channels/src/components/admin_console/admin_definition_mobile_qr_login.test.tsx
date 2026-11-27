// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {AdminConfig} from '@mattermost/types/config';

import {RESOURCE_KEYS} from 'mattermost-redux/constants/permissions_sysconsole';

import AdminDefinition from './admin_definition';
import type {AdminDefinitionSetting} from './types';

describe('AdminDefinition - Mobile QR Login Settings', () => {
    const getSettings = () => {
        const mobileSecurity = AdminDefinition.environment.subsections.mobile_security;
        const sections = 'sections' in mobileSecurity.schema! ? mobileSecurity.schema.sections : undefined;
        return sections?.find((section) => section.key === 'MobileSecuritySettings.MobileQRLogin')?.settings ?? [];
    };

    const getSetting = (key: string) => getSettings().find((s: AdminDefinitionSetting) => s.key === key);

    const state = (enabled: boolean) => ({'ServiceSettings.EnableMobileQRLogin': enabled});

    const isDisabled = (setting: AdminDefinitionSetting | undefined, enabled: boolean, writeAccess: boolean) => {
        const consoleAccess = {read: {}, write: {[RESOURCE_KEYS.ENVIRONMENT.MOBILE_SECURITY]: writeAccess}} as never;
        const fn = setting?.isDisabled;
        if (typeof fn !== 'function') {
            return Boolean(fn);
        }
        return fn({} as Partial<AdminConfig>, state(enabled), undefined, true, consoleAccess, undefined, false);
    };

    test('defines the enable toggle and the expiry number', () => {
        expect(getSetting('ServiceSettings.EnableMobileQRLogin')?.type).toBe('bool');
        expect(getSetting('ServiceSettings.MobileQRLoginTokenExpirySeconds')?.type).toBe('number');
    });

    test('expiry is disabled until the feature is enabled', () => {
        const expiry = getSetting('ServiceSettings.MobileQRLoginTokenExpirySeconds');

        expect(isDisabled(expiry, false, true)).toBe(true);
        expect(isDisabled(expiry, true, true)).toBe(false);
    });

    test('both settings are read-only without write access to Mobile Security', () => {
        expect(isDisabled(getSetting('ServiceSettings.EnableMobileQRLogin'), true, false)).toBe(true);
        expect(isDisabled(getSetting('ServiceSettings.EnableMobileQRLogin'), true, true)).toBe(false);
        expect(isDisabled(getSetting('ServiceSettings.MobileQRLoginTokenExpirySeconds'), true, false)).toBe(true);
    });

    test.each([
        [60, true],
        [90, true],
        [120, true],
        [59, false],
        [121, false],
    ])('expiry of %s seconds validity is %s', (value, valid) => {
        const setting = getSetting('ServiceSettings.MobileQRLoginTokenExpirySeconds');
        const validate = setting && 'validate' in setting ? setting.validate : undefined;

        expect(validate?.(value).isValid()).toBe(valid);
    });
});
