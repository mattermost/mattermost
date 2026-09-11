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
