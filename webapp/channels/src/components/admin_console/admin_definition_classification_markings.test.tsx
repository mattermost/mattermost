// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {AdminConfig, ClientLicense} from '@mattermost/types/config';

import {RESOURCE_KEYS} from 'mattermost-redux/constants/permissions_sysconsole';

import {LicenseSkus} from 'utils/constants';

import AdminDefinition from './admin_definition';
import ClassificationMarkingsFeatureDiscovery from './feature_discovery/features/classification_markings';
import type {AdminDefinitionSetting, AdminDefinitionSubSection, Check, ConsoleAccess} from './types';

const classificationConfigEnabled = {
    FeatureFlags: {
        ClassificationMarkings: true,
    },
} as unknown as Partial<AdminConfig>;

const classificationConfigDisabled = {
    FeatureFlags: {
        ClassificationMarkings: false,
    },
} as unknown as Partial<AdminConfig>;

const consoleAccess = {
    read: {},
    write: {
        [RESOURCE_KEYS.ABOUT.EDITION_AND_LICENSE]: true,
    },
} as ConsoleAccess;

const consoleAccessWithoutLicenseWrite = {
    ...consoleAccess,
    write: {
        ...consoleAccess.write,
        [RESOURCE_KEYS.ABOUT.EDITION_AND_LICENSE]: false,
    },
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

type CustomAdminDefinitionSetting = Extract<AdminDefinitionSetting, {type: 'custom'}>;

function isHidden(subsection: AdminDefinitionSubSection, config: Partial<AdminConfig>, license: ClientLicense) {
    const check = subsection.isHidden as Extract<Check, (...args: any[]) => boolean>;
    return check(config, {}, license, true, consoleAccess);
}

function isDisabled(check: Check | undefined, access: ConsoleAccess) {
    const disabledCheck = check as Extract<Check, (...args: any[]) => boolean>;
    return disabledCheck(classificationConfigEnabled, {}, professionalLicense, true, access);
}

describe('AdminDefinition - Classification Markings discovery', () => {
    const settingsSubsection = AdminDefinition.site.subsections.classification_markings;
    const discoverySubsection = AdminDefinition.site.subsections.classification_markings_feature_discovery;

    test('includes a discovery route at the Classification Markings URL', () => {
        expect(discoverySubsection).toBeDefined();
        expect(discoverySubsection.url).toBe(settingsSubsection.url);
        expect(discoverySubsection.isDiscovery).toBe(true);
        expect(discoverySubsection.title).toEqual(settingsSubsection.title);
        expect(discoverySubsection.restrictedIndicator).toBeDefined();

        const schema = discoverySubsection.schema;
        expect('name' in schema ? schema.name : undefined).toEqual(settingsSubsection.title);
    });

    test('shows discovery instead of settings for Professional licenses', () => {
        expect(isHidden(settingsSubsection, classificationConfigEnabled, professionalLicense)).toBe(true);
        expect(isHidden(discoverySubsection, classificationConfigEnabled, professionalLicense)).toBe(false);
    });

    test('shows discovery instead of settings when unlicensed', () => {
        expect(isHidden(settingsSubsection, classificationConfigEnabled, unlicensed)).toBe(true);
        expect(isHidden(discoverySubsection, classificationConfigEnabled, unlicensed)).toBe(false);
    });

    test('shows settings instead of discovery for Enterprise licenses', () => {
        expect(isHidden(settingsSubsection, classificationConfigEnabled, enterpriseLicense)).toBe(false);
        expect(isHidden(discoverySubsection, classificationConfigEnabled, enterpriseLicense)).toBe(true);
    });

    test('shows settings instead of discovery for Enterprise Advanced licenses', () => {
        expect(isHidden(settingsSubsection, classificationConfigEnabled, enterpriseAdvancedLicense)).toBe(false);
        expect(isHidden(discoverySubsection, classificationConfigEnabled, enterpriseAdvancedLicense)).toBe(true);
    });

    test('shows settings instead of discovery for Entry licenses', () => {
        expect(isHidden(settingsSubsection, classificationConfigEnabled, entryLicense)).toBe(false);
        expect(isHidden(discoverySubsection, classificationConfigEnabled, entryLicense)).toBe(true);
    });

    test('disables the settings page for non system admins', () => {
        const settingsDisabledCheck = settingsSubsection.isDisabled as Extract<Check, (...args: any[]) => boolean>;

        const asSystemAdmin = settingsDisabledCheck(classificationConfigEnabled, {}, enterpriseAdvancedLicense, true, consoleAccess, undefined, true);
        const asNonSystemAdmin = settingsDisabledCheck(classificationConfigEnabled, {}, enterpriseAdvancedLicense, true, consoleAccess, undefined, false);

        expect(asSystemAdmin).toBe(false);
        expect(asNonSystemAdmin).toBe(true);
    });

    test('hides both settings and discovery when the Classification Markings feature flag is disabled', () => {
        expect(isHidden(settingsSubsection, classificationConfigDisabled, professionalLicense)).toBe(true);
        expect(isHidden(discoverySubsection, classificationConfigDisabled, professionalLicense)).toBe(true);

        // The disabled flag must override an otherwise-unlocking license.
        expect(isHidden(settingsSubsection, classificationConfigDisabled, enterpriseLicense)).toBe(true);
        expect(isHidden(discoverySubsection, classificationConfigDisabled, enterpriseLicense)).toBe(true);
    });

    test('renders the Classification Markings feature discovery component through a custom setting', () => {
        const schema = discoverySubsection.schema;
        expect('settings' in schema).toBe(true);

        const settings = 'settings' in schema ? schema.settings ?? [] : [];
        const discoverySetting = settings.find((setting): setting is CustomAdminDefinitionSetting => (
            setting.type === 'custom' && setting.key === 'ClassificationMarkingsFeatureDiscovery'
        ));

        expect(discoverySetting).toBeDefined();
        expect(discoverySetting?.type).toBe('custom');
        expect(discoverySetting?.component).toBe(ClassificationMarkingsFeatureDiscovery);
        expect(isDisabled(discoverySetting?.isDisabled, consoleAccess)).toBe(false);
        expect(isDisabled(discoverySetting?.isDisabled, consoleAccessWithoutLicenseWrite)).toBe(true);
    });
});
