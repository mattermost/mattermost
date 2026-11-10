// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {AdminConfig, ClientLicense} from '@mattermost/types/config';

import {LicenseSkus} from 'utils/constants';

import AdminDefinition from './admin_definition';
import type {AdminDefinitionSubSection, Check, ConsoleAccess} from './types';

const boardsFlagEnabled = {
    FeatureFlags: {
        IntegratedBoards: true,
    },
} as unknown as Partial<AdminConfig>;

const boardsFlagDisabled = {
    FeatureFlags: {
        IntegratedBoards: false,
    },
} as unknown as Partial<AdminConfig>;

const consoleAccess = {
    read: {},
    write: {},
} as ConsoleAccess;

const professionalLicense = {
    IsLicensed: 'true',
    SkuShortName: LicenseSkus.Professional,
} as ClientLicense;

const enterpriseLicense = {
    IsLicensed: 'true',
    SkuShortName: LicenseSkus.Enterprise,
} as ClientLicense;

const enterpriseAdvancedLicense = {
    IsLicensed: 'true',
    SkuShortName: LicenseSkus.EnterpriseAdvanced,
} as ClientLicense;

const entryLicense = {
    IsLicensed: 'true',
    SkuShortName: LicenseSkus.Entry,
} as ClientLicense;

const unlicensed = {
    IsLicensed: 'false',
} as ClientLicense;

function isHidden(subsection: AdminDefinitionSubSection, config: Partial<AdminConfig>, license: ClientLicense) {
    const check = subsection.isHidden as Extract<Check, (...args: any[]) => boolean>;
    return check(config, {}, license, true, consoleAccess);
}

describe('AdminDefinition - Board Attributes license gating', () => {
    const settingsSubsection = AdminDefinition.system_attributes.subsections.board_attributes;

    test('hides Board Attributes for Professional licenses', () => {
        expect(isHidden(settingsSubsection, boardsFlagEnabled, professionalLicense)).toBe(true);
    });

    test('hides Board Attributes when unlicensed', () => {
        expect(isHidden(settingsSubsection, boardsFlagEnabled, unlicensed)).toBe(true);
    });

    test('shows Board Attributes for Enterprise licenses', () => {
        expect(isHidden(settingsSubsection, boardsFlagEnabled, enterpriseLicense)).toBe(false);
    });

    test('shows Board Attributes for Enterprise Advanced licenses', () => {
        expect(isHidden(settingsSubsection, boardsFlagEnabled, enterpriseAdvancedLicense)).toBe(false);
    });

    test('shows Board Attributes for Entry licenses', () => {
        expect(isHidden(settingsSubsection, boardsFlagEnabled, entryLicense)).toBe(false);
    });

    test('hides Board Attributes when the IntegratedBoards feature flag is disabled', () => {
        // The disabled flag must override an otherwise-unlocking license.
        expect(isHidden(settingsSubsection, boardsFlagDisabled, enterpriseLicense)).toBe(true);
        expect(isHidden(settingsSubsection, boardsFlagDisabled, enterpriseAdvancedLicense)).toBe(true);
        expect(isHidden(settingsSubsection, boardsFlagDisabled, professionalLicense)).toBe(true);
    });
});
