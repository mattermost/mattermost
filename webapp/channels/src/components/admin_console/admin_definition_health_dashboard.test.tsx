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
const entryLicense = {IsLicensed: 'true', SkuShortName: LicenseSkus.Entry} as ClientLicense;
const cloudEnterpriseLicense = {IsLicensed: 'true', SkuShortName: LicenseSkus.Enterprise, Cloud: 'true'} as ClientLicense;
const starterLicense = {IsLicensed: 'true', SkuShortName: LicenseSkus.Starter} as ClientLicense;
const noLicense = {IsLicensed: 'false'} as ClientLicense;

type Viewer = {isSystemAdmin: boolean; canReadSiteStatistics: boolean};
const systemAdmin: Viewer = {isSystemAdmin: true, canReadSiteStatistics: true};
const delegatedAdmin: Viewer = {isSystemAdmin: false, canReadSiteStatistics: true};
const delegatedAdminWithoutSiteStatistics: Viewer = {isSystemAdmin: false, canReadSiteStatistics: false};

const reporting = AdminDefinition.reporting.subsections;
type ReportingKey = keyof typeof reporting;

function isHidden(key: ReportingKey, license: ClientLicense, viewer = systemAdmin, flag = true) {
    const check: Check | undefined = reporting[key].isHidden;
    if (typeof check !== 'function') {
        return Boolean(check);
    }
    const consoleAccess = {
        read: {[RESOURCE_KEYS.REPORTING.SITE_STATISTICS]: viewer.canReadSiteStatistics},
        write: {[RESOURCE_KEYS.REPORTING.SITE_STATISTICS]: viewer.isSystemAdmin},
    } as ConsoleAccess;
    return check({FeatureFlags: {HealthDashboard: flag}}, {}, license, true, consoleAccess, undefined, viewer.isSystemAdmin);
}

describe('AdminDefinition - Site health', () => {
    test('is registered under Reporting at reporting/site_health', () => {
        expect(reporting.site_health.url).toBe('reporting/site_health');
    });

    test('is shown to a system admin with the feature flag on and a Professional or higher license', () => {
        expect(isHidden('site_health', professionalLicense)).toBe(false);
        expect(isHidden('site_health', enterpriseLicense)).toBe(false);
        expect(isHidden('site_health', enterpriseAdvancedLicense)).toBe(false);
        expect(isHidden('site_health', entryLicense)).toBe(false);
    });

    test('is shown to a delegated admin who can read Site Statistics', () => {
        expect(isHidden('site_health', enterpriseLicense, delegatedAdmin)).toBe(false);
    });

    test('is hidden from a delegated admin who cannot read Site Statistics', () => {
        expect(isHidden('site_health', enterpriseLicense, delegatedAdminWithoutSiteStatistics)).toBe(true);
    });

    test('is hidden when the feature flag is off', () => {
        expect(isHidden('site_health', enterpriseLicense, systemAdmin, false)).toBe(true);
        expect(isHidden('site_health', enterpriseLicense, delegatedAdmin, false)).toBe(true);
    });

    test('is hidden below a Professional license', () => {
        for (const viewer of [systemAdmin, delegatedAdmin]) {
            expect(isHidden('site_health', starterLicense, viewer)).toBe(true);
            expect(isHidden('site_health', noLicense, viewer)).toBe(true);
        }
    });
});

describe('AdminDefinition - Site health or Workspace Optimization, never both', () => {
    test('flag on with a Professional or higher license shows Site health and hides Workspace Optimization', () => {
        for (const license of [professionalLicense, enterpriseLicense]) {
            for (const viewer of [systemAdmin, delegatedAdmin]) {
                expect(isHidden('site_health', license, viewer)).toBe(false);
                expect(isHidden('workspace_optimization', license, viewer)).toBe(true);
            }
        }
    });

    test('flag off shows Workspace Optimization and hides Site health', () => {
        for (const viewer of [systemAdmin, delegatedAdmin]) {
            expect(isHidden('workspace_optimization', enterpriseLicense, viewer, false)).toBe(false);
            expect(isHidden('site_health', enterpriseLicense, viewer, false)).toBe(true);
        }
    });

    test('flag on below Professional shows only Workspace Optimization', () => {
        for (const license of [starterLicense, noLicense]) {
            expect(isHidden('workspace_optimization', license)).toBe(false);
            expect(isHidden('site_health', license)).toBe(true);
        }
    });

    test('a delegated admin who cannot read Site Statistics sees neither dashboard', () => {
        for (const flag of [true, false]) {
            expect(isHidden('site_health', enterpriseLicense, delegatedAdminWithoutSiteStatistics, flag)).toBe(true);
            expect(isHidden('workspace_optimization', enterpriseLicense, delegatedAdminWithoutSiteStatistics, flag)).toBe(true);
        }
    });

    test('flag on with a Cloud Enterprise license shows Site health only', () => {
        expect(isHidden('site_health', cloudEnterpriseLicense)).toBe(false);
        expect(isHidden('workspace_optimization', cloudEnterpriseLicense)).toBe(true);
    });

    test('never shows both dashboards', () => {
        const licenses = [enterpriseLicense, enterpriseAdvancedLicense, professionalLicense, entryLicense, starterLicense, cloudEnterpriseLicense, noLicense];
        for (const license of licenses) {
            for (const flag of [true, false]) {
                for (const viewer of [systemAdmin, delegatedAdmin, delegatedAdminWithoutSiteStatistics]) {
                    const visible = (Object.keys(reporting) as ReportingKey[]).filter((key) => !isHidden(key, license, viewer, flag));
                    expect(visible.includes('site_health') && visible.includes('workspace_optimization')).toBe(false);
                }
            }
        }
    });
});
