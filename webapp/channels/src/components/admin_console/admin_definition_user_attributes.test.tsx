// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {AdminConfig, ClientLicense} from '@mattermost/types/config';

import {LicenseSkus} from 'utils/constants';

import AdminDefinition from './admin_definition';
import type {Check, ConsoleAccess} from './types';

const config = {} as Partial<AdminConfig>;

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

function isDiscoveryHidden(license: ClientLicense) {
    const subsection = AdminDefinition.system_attributes.subsections.user_attributes_feature_discovery;
    const check = subsection.isHidden as Extract<Check, (...args: any[]) => boolean>;
    return check(config, {}, license, true, consoleAccess);
}

function isRedirectHidden(license: ClientLicense) {
    const subsection = AdminDefinition.system_attributes.subsections.user_attributes_redirect;
    const check = subsection.isHidden as Extract<Check, (...args: any[]) => boolean>;
    return check(config, {}, license, true, consoleAccess);
}

describe('AdminDefinition - user_attributes_feature_discovery access gate', () => {
    test('is visible below Enterprise license', () => {
        expect(isDiscoveryHidden(professionalLicense)).toBe(false);
    });

    test('is visible when unlicensed', () => {
        expect(isDiscoveryHidden(unlicensed)).toBe(false);
    });

    test('is hidden on Enterprise+ license', () => {
        expect(isDiscoveryHidden(enterpriseLicense)).toBe(true);
    });
});

describe('AdminDefinition - user_attributes_redirect access gate', () => {
    test('is hidden below Enterprise license', () => {
        expect(isRedirectHidden(professionalLicense)).toBe(true);
    });

    test('is hidden when unlicensed', () => {
        expect(isRedirectHidden(unlicensed)).toBe(true);
    });

    test('is visible on Enterprise+ license', () => {
        expect(isRedirectHidden(enterpriseLicense)).toBe(false);
    });
});

describe('AdminDefinition - system_attributes/user_attributes always has a registered route', () => {
    // Both subsections above are registered at the same URL. If both are ever
    // hidden for a given license, the admin console has no route for that URL
    // and silently redirects elsewhere (admin_console.tsx's catch-all
    // <Redirect>) instead of showing anything -- this is exactly the
    // regression this test exists to catch.
    const cases: Array<[string, ClientLicense]> = [
        ['unlicensed', unlicensed],
        ['below Enterprise', professionalLicense],
        ['Enterprise+', enterpriseLicense],
    ];

    test.each(cases)('at least one of the two is visible when %s', (_name, license) => {
        expect(isDiscoveryHidden(license) && isRedirectHidden(license)).toBe(false);
    });
});
