// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {AdminConfig, ClientLicense} from '@mattermost/types/config';

import {RESOURCE_KEYS} from 'mattermost-redux/constants/permissions_sysconsole';

import {LicenseSkus} from 'utils/constants';

import AdminDefinition from './admin_definition';
import type {Check, ConsoleAccess} from './types';

const enterpriseAdvancedLicense = {IsLicensed: 'true', SkuShortName: LicenseSkus.EnterpriseAdvanced} as ClientLicense;
const enterpriseLicense = {IsLicensed: 'true', SkuShortName: LicenseSkus.Enterprise} as ClientLicense;
const noLicense = {IsLicensed: 'false'} as ClientLicense;

const delegatedSystemRolesAccess = {
    read: {[RESOURCE_KEYS.USER_MANAGEMENT.SYSTEM_ROLES]: true},
    write: {[RESOURCE_KEYS.USER_MANAGEMENT.SYSTEM_ROLES]: true},
} as ConsoleAccess;

const subsections = AdminDefinition.system_attributes.subsections;
const scopedSubsections = [
    subsections.scoped_configuration,
    subsections.scoped_configuration_details,
    subsections.scoped_configuration_details_edit,
    subsections.scoped_configuration_details_prefill,
] as const;

function makeConfig(abac = true, flag = true): Partial<AdminConfig> {
    return {
        AccessControlSettings: {
            EnableAttributeBasedAccessControl: abac,
        } as AdminConfig['AccessControlSettings'],
        FeatureFlags: {
            SystemSettingPolicies: flag,
        },
    };
}

function runCheck(check: Check | undefined, config: Partial<AdminConfig>, license: ClientLicense, isSystemAdmin: boolean) {
    if (typeof check !== 'function') {
        return Boolean(check);
    }
    return check(config, {}, license, true, delegatedSystemRolesAccess, undefined, isSystemAdmin);
}

describe('AdminDefinition - Scoped Configuration RBAC and gating', () => {
    test('is visible and enabled for system admins when Enterprise Advanced, ABAC, and flag are enabled', () => {
        for (const sub of scopedSubsections) {
            expect(runCheck(sub.isHidden, makeConfig(true, true), enterpriseAdvancedLicense, true)).toBe(false);
            expect(runCheck(sub.isDisabled, makeConfig(true, true), enterpriseAdvancedLicense, true)).toBe(false);
        }
    });

    test('is hidden and disabled for delegated admins lacking system admin even with system_roles console access', () => {
        for (const sub of scopedSubsections) {
            expect(runCheck(sub.isHidden, makeConfig(true, true), enterpriseAdvancedLicense, false)).toBe(true);
            expect(runCheck(sub.isDisabled, makeConfig(true, true), enterpriseAdvancedLicense, false)).toBe(true);
        }
    });

    test('is hidden when unlicensed, below Enterprise Advanced, ABAC disabled, or feature flag off', () => {
        for (const sub of scopedSubsections) {
            expect(runCheck(sub.isHidden, makeConfig(true, true), noLicense, true)).toBe(true);
            expect(runCheck(sub.isHidden, makeConfig(true, true), enterpriseLicense, true)).toBe(true);
            expect(runCheck(sub.isHidden, makeConfig(false, true), enterpriseAdvancedLicense, true)).toBe(true);
            expect(runCheck(sub.isHidden, makeConfig(true, false), enterpriseAdvancedLicense, true)).toBe(true);
        }
    });
});
