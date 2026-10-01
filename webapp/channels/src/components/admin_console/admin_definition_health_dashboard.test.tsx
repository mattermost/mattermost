// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ClientLicense} from '@mattermost/types/config';

import {getConfig} from 'mattermost-redux/selectors/entities/general';

import {LicenseSkus} from 'utils/constants';

import AdminDefinition from './admin_definition';
import type {Check, ConsoleAccess} from './types';

jest.mock('mattermost-redux/selectors/entities/general', () => ({
    ...jest.requireActual('mattermost-redux/selectors/entities/general'),
    getConfig: jest.fn(),
}));

const mockedGetConfig = getConfig as jest.Mock;

const enterpriseLicense = {IsLicensed: 'true', SkuShortName: LicenseSkus.Enterprise} as ClientLicense;
const professionalLicense = {IsLicensed: 'true', SkuShortName: LicenseSkus.Professional} as ClientLicense;
const fullAccess = {read: {}, write: {}} as ConsoleAccess;

function isHidden(license: ClientLicense, isSystemAdmin: boolean) {
    const check = AdminDefinition.reporting.subsections.site_health.isHidden as Exclude<Check, boolean>;
    return check({}, {}, license, true, fullAccess, undefined, isSystemAdmin);
}

describe('AdminDefinition - Site health', () => {
    afterEach(() => {
        mockedGetConfig.mockReset();
    });

    test('is registered under Reporting at reporting/site_health', () => {
        expect(AdminDefinition.reporting.subsections.site_health.url).toBe('reporting/site_health');
    });

    test('is shown to a system admin with the feature flag on and an Enterprise license', () => {
        mockedGetConfig.mockReturnValue({FeatureFlagHealthDashboard: 'true'});

        expect(isHidden(enterpriseLicense, true)).toBe(false);
    });

    test('is hidden when the feature flag is off', () => {
        mockedGetConfig.mockReturnValue({FeatureFlagHealthDashboard: 'false'});

        expect(isHidden(enterpriseLicense, true)).toBe(true);
    });

    test('is hidden below an Enterprise license', () => {
        mockedGetConfig.mockReturnValue({FeatureFlagHealthDashboard: 'true'});

        expect(isHidden(professionalLicense, true)).toBe(true);
    });

    test('is hidden from anyone who is not a system admin', () => {
        mockedGetConfig.mockReturnValue({FeatureFlagHealthDashboard: 'true'});

        expect(isHidden(enterpriseLicense, false)).toBe(true);
    });
});
