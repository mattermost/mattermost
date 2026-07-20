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

const consoleAccess = {read: {}, write: {}} as ConsoleAccess;

function isHidden(config: Partial<AdminConfig>, license: ClientLicense, isSystemAdmin: boolean) {
    const subsection = AdminDefinition.system_attributes.subsections.global_attributes;
    const check = subsection.isHidden as Extract<Check, (...args: any[]) => boolean>;
    return check(config, {}, license, true, consoleAccess, undefined, isSystemAdmin);
}

describe('AdminDefinition - Global Attributes access gate', () => {
    test('is hidden by default: flag off, license below Enterprise, non-sysadmin', () => {
        expect(isHidden(flagOff, professionalLicense, false)).toBe(true);
    });

    test('stays hidden when license is below Enterprise, even with flag on and sysadmin', () => {
        expect(isHidden(flagOn, professionalLicense, true)).toBe(true);
    });

    test('stays hidden for a non-sysadmin, even with flag on and Enterprise license', () => {
        expect(isHidden(flagOn, enterpriseLicense, false)).toBe(true);
    });

    test('stays hidden when the flag is off, even with Enterprise license and sysadmin', () => {
        expect(isHidden(flagOff, enterpriseLicense, true)).toBe(true);
    });

    test('is visible only when flag is on, license is Enterprise+, and viewer is a sysadmin', () => {
        expect(isHidden(flagOn, enterpriseLicense, true)).toBe(false);
    });
});
