// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ClientLicense} from '@mattermost/types/config';

import {LicenseSkus} from 'utils/constants';

import AdminDefinition from './admin_definition';
import type {Check, ConsoleAccess} from './types';

const enterpriseLicense = {IsLicensed: 'true', SkuShortName: LicenseSkus.Enterprise} as ClientLicense;
const professionalLicense = {IsLicensed: 'true', SkuShortName: LicenseSkus.Professional} as ClientLicense;
const fullAccess = {read: {}, write: {}} as ConsoleAccess;

function isHidden(license: ClientLicense, isSystemAdmin: boolean, flag = true) {
    const check = AdminDefinition.reporting.subsections.site_health.isHidden as Exclude<Check, boolean>;
    return check({FeatureFlags: {HealthDashboard: flag}}, {}, license, true, fullAccess, undefined, isSystemAdmin);
}

describe('AdminDefinition - Site health', () => {
    test('is registered under Reporting at reporting/site_health', () => {
        expect(AdminDefinition.reporting.subsections.site_health.url).toBe('reporting/site_health');
    });

    test('is shown to a system admin with the feature flag on and an Enterprise license', () => {
        expect(isHidden(enterpriseLicense, true)).toBe(false);
    });

    test('is hidden when the feature flag is off', () => {
        expect(isHidden(enterpriseLicense, true, false)).toBe(true);
    });

    test('is hidden below an Enterprise license', () => {
        expect(isHidden(professionalLicense, true)).toBe(true);
    });

    test('is hidden from anyone who is not a system admin', () => {
        expect(isHidden(enterpriseLicense, false)).toBe(true);
    });
});
