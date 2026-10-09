// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ClientLicense} from '@mattermost/types/config';

import {RESOURCE_KEYS} from 'mattermost-redux/constants/permissions_sysconsole';

import {LicenseSkus} from 'utils/constants';

import AdminDefinition from './admin_definition';
import type {Check, ConsoleAccess} from './types';

const enterpriseLicense = {IsLicensed: 'true', SkuShortName: LicenseSkus.Enterprise} as ClientLicense;
const enterpriseAdvancedLicense = {IsLicensed: 'true', SkuShortName: LicenseSkus.EnterpriseAdvanced} as ClientLicense;
const professionalLicense = {IsLicensed: 'true', SkuShortName: LicenseSkus.Professional} as ClientLicense;
const cloudEnterpriseLicense = {IsLicensed: 'true', SkuShortName: LicenseSkus.Enterprise, Cloud: 'true'} as ClientLicense;
const noLicense = {IsLicensed: 'false'} as ClientLicense;
const reportingAccess = {
    read: {[RESOURCE_KEYS.REPORTING.SITE_STATISTICS]: true},
    write: {[RESOURCE_KEYS.REPORTING.SITE_STATISTICS]: true},
} as ConsoleAccess;

const reporting = AdminDefinition.reporting.subsections;
type ReportingKey = keyof typeof reporting;

function isHidden(key: ReportingKey, license: ClientLicense, isSystemAdmin = true, flag = true) {
    const check: Check | undefined = reporting[key].isHidden;
    if (typeof check !== 'function') {
        return Boolean(check);
    }
    return check({FeatureFlags: {HealthDashboard: flag}}, {}, license, true, reportingAccess, undefined, isSystemAdmin);
}

describe('AdminDefinition - Site health', () => {
    test('is registered under Reporting at reporting/site_health', () => {
        expect(reporting.site_health.url).toBe('reporting/site_health');
    });

    test('is shown to a system admin with the feature flag on and an Enterprise license', () => {
        expect(isHidden('site_health', enterpriseLicense)).toBe(false);
        expect(isHidden('site_health', enterpriseAdvancedLicense)).toBe(false);
    });

    test('is hidden when the feature flag is off', () => {
        expect(isHidden('site_health', enterpriseLicense, true, false)).toBe(true);
    });

    test('is hidden below an Enterprise license', () => {
        expect(isHidden('site_health', professionalLicense)).toBe(true);
        expect(isHidden('site_health', noLicense)).toBe(true);
    });

    test('is hidden from anyone who is not a system admin', () => {
        expect(isHidden('site_health', enterpriseLicense, false)).toBe(true);
    });
});

describe('AdminDefinition - Site health or Workspace Optimization, never both', () => {
    test('flag on with an Enterprise license shows Site health and hides Workspace Optimization', () => {
        expect(isHidden('site_health', enterpriseLicense)).toBe(false);
        expect(isHidden('workspace_optimization', enterpriseLicense)).toBe(true);
    });

    test('flag off shows Workspace Optimization and hides Site health', () => {
        expect(isHidden('workspace_optimization', enterpriseLicense, true, false)).toBe(false);
        expect(isHidden('site_health', enterpriseLicense, true, false)).toBe(true);
    });

    test('flag on below Enterprise shows only Workspace Optimization', () => {
        for (const license of [professionalLicense, noLicense]) {
            expect(isHidden('workspace_optimization', license)).toBe(false);
            expect(isHidden('site_health', license)).toBe(true);
        }
    });

    test('flag on with an Enterprise license hides Workspace Optimization from admins who cannot see Site health', () => {
        expect(isHidden('site_health', enterpriseLicense, false)).toBe(true);
        expect(isHidden('workspace_optimization', enterpriseLicense, false)).toBe(true);
    });

    test('flag on with a Cloud Enterprise license shows Site health only', () => {
        expect(isHidden('site_health', cloudEnterpriseLicense)).toBe(false);
        expect(isHidden('workspace_optimization', cloudEnterpriseLicense)).toBe(true);
    });

    test('at most one Reporting page is routed per URL, and never both dashboards', () => {
        const licenses = [enterpriseLicense, enterpriseAdvancedLicense, professionalLicense, cloudEnterpriseLicense, noLicense];
        for (const license of licenses) {
            for (const flag of [true, false]) {
                for (const isSystemAdmin of [true, false]) {
                    const visible = (Object.keys(reporting) as ReportingKey[]).filter((key) => !isHidden(key, license, isSystemAdmin, flag));
                    const urls = visible.map((key) => reporting[key].url);

                    expect(new Set(urls).size).toBe(urls.length);
                    expect(visible.includes('site_health') && visible.includes('workspace_optimization')).toBe(false);
                }
            }
        }
    });

    test('reporting/workspace_optimization redirects to Site health while Site health is shown', () => {
        expect(reporting.workspace_optimization_redirect.url).toBe(reporting.workspace_optimization.url);
        expect(isHidden('workspace_optimization_redirect', enterpriseLicense)).toBe(false);
        expect(isHidden('workspace_optimization_redirect', enterpriseLicense, true, false)).toBe(true);
        expect(isHidden('workspace_optimization_redirect', professionalLicense)).toBe(true);
    });

    test('reporting/site_health redirects to Workspace Optimization while Workspace Optimization is shown', () => {
        expect(reporting.site_health_redirect.url).toBe(reporting.site_health.url);
        expect(isHidden('site_health_redirect', enterpriseLicense, true, false)).toBe(false);
        expect(isHidden('site_health_redirect', professionalLicense)).toBe(false);
        expect(isHidden('site_health_redirect', enterpriseLicense)).toBe(true);
    });
});
