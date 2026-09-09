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
    const subsection = AdminDefinition.system_attributes.subsections.global_attributes;
    const check = subsection.isHidden as Extract<Check, (...args: any[]) => boolean>;
    return check(config, {}, license, true, consoleAccess);
}

function isDisabled(isSystemAdmin: boolean) {
    const subsection = AdminDefinition.system_attributes.subsections.global_attributes;
    const check = subsection.isDisabled as Extract<Check, (...args: any[]) => boolean>;
    return check(flagOn, {}, enterpriseLicense, true, consoleAccess, undefined, isSystemAdmin);
}

describe('AdminDefinition - Global Attributes access gate', () => {
    test('is hidden by default: flag off, license below Enterprise', () => {
        expect(isHidden(flagOff, professionalLicense)).toBe(true);
    });

    test('stays hidden when license is below Enterprise, even with flag on', () => {
        expect(isHidden(flagOn, professionalLicense)).toBe(true);
    });

    test('stays hidden when unlicensed, even with flag on', () => {
        expect(isHidden(flagOn, unlicensed)).toBe(true);
    });

    test('stays hidden when the flag is off, even with Enterprise license', () => {
        expect(isHidden(flagOff, enterpriseLicense)).toBe(true);
    });

    test('is visible when flag is on and license is Enterprise+', () => {
        expect(isHidden(flagOn, enterpriseLicense)).toBe(false);
    });

    test('disables the page for non-sysadmins', () => {
        expect(isDisabled(true)).toBe(false);
        expect(isDisabled(false)).toBe(true);
    });
});
