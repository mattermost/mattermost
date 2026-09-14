// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {AdminConfig, ClientLicense} from '@mattermost/types/config';

import {LicenseSkus} from 'utils/constants';

import AdminDefinition from './admin_definition';
import type {Check, ConsoleAccess} from './types';

const flagOn = {
    FeatureFlags: {
        GlobalAttributes: true,
    },
} as unknown as Partial<AdminConfig>;

const flagOff = {
    FeatureFlags: {
        GlobalAttributes: false,
    },
} as unknown as Partial<AdminConfig>;

const enterpriseLicense = {
    IsLicensed: 'true',
    SkuShortName: LicenseSkus.Enterprise,
} as ClientLicense;

const professionalLicense = {
    IsLicensed: 'true',
    SkuShortName: LicenseSkus.Professional,
} as ClientLicense;

const unlicensed = {
    IsLicensed: 'false',
} as ClientLicense;

const consoleAccess = {read: {}, write: {}} as ConsoleAccess;

function isHidden(config: Partial<AdminConfig>, license: ClientLicense) {
    const subsection = AdminDefinition.system_attributes.subsections.system_properties;
    const check = subsection.isHidden as Extract<Check, (...args: any[]) => boolean>;
    return check(config, {}, license, true, consoleAccess);
}

function isDiscoveryHidden(config: Partial<AdminConfig>, license: ClientLicense) {
    const subsection = AdminDefinition.system_attributes.subsections.user_attributes_feature_discovery;
    const check = subsection.isHidden as Extract<Check, (...args: any[]) => boolean>;
    return check(config, {}, license, true, consoleAccess);
}

describe('AdminDefinition - User Attributes (system_properties) access gate', () => {
    test('is hidden when license is below Enterprise, flag off', () => {
        expect(isHidden(flagOff, professionalLicense)).toBe(true);
    });

    test('is hidden when unlicensed, flag off', () => {
        expect(isHidden(flagOff, unlicensed)).toBe(true);
    });

    test('is visible on Enterprise license with the flag off (backward-compat fallback)', () => {
        expect(isHidden(flagOff, enterpriseLicense)).toBe(false);
    });

    test('is hidden on Enterprise license once the flag is on', () => {
        expect(isHidden(flagOn, enterpriseLicense)).toBe(true);
    });

    test('stays hidden when license is below Enterprise, even with the flag on', () => {
        expect(isHidden(flagOn, professionalLicense)).toBe(true);
    });

    test('stays hidden when unlicensed, even with the flag on', () => {
        expect(isHidden(flagOn, unlicensed)).toBe(true);
    });
});

describe('AdminDefinition - system_properties and user_attributes_feature_discovery never share the same URL with both hidden', () => {
    // Both subsections are registered at 'system_attributes/user_attributes'.
    // If both are hidden for a given config/license combination, the admin
    // console has no route for that URL and silently redirects elsewhere
    // (admin_console.tsx's catch-all <Redirect>) instead of showing anything.
    const cases: Array<[string, Partial<AdminConfig>, ClientLicense]> = [
        ['unlicensed, flag off', flagOff, unlicensed],
        ['unlicensed, flag on', flagOn, unlicensed],
        ['below Enterprise, flag off', flagOff, professionalLicense],
        ['below Enterprise, flag on', flagOn, professionalLicense],
        ['Enterprise, flag off', flagOff, enterpriseLicense],
        ['Enterprise, flag on', flagOn, enterpriseLicense],
    ];

    test.each(cases)('at least one of the two is visible when %s', (_name, config, license) => {
        expect(isHidden(config, license) && isDiscoveryHidden(config, license)).toBe(false);
    });
});
