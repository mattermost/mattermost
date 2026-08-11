// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {AdminConfig, ClientLicense} from '@mattermost/types/config';

import {RESOURCE_KEYS} from 'mattermost-redux/constants/permissions_sysconsole';

import {LicenseSkus} from 'utils/constants';

import AdminDefinition from './admin_definition';
import DataSpillageFeatureDiscovery from './feature_discovery/features/data_spillage';
import type {AdminDefinitionSetting, AdminDefinitionSubSection, Check, ConsoleAccess} from './types';

const contentFlaggingConfigEnabled = {
    FeatureFlags: {
        ContentFlagging: true,
    },
} as unknown as Partial<AdminConfig>;

const contentFlaggingConfigDisabled = {
    FeatureFlags: {
        ContentFlagging: false,
    },
} as unknown as Partial<AdminConfig>;

const consoleAccess = {
    read: {
        [RESOURCE_KEYS.SITE.POSTS]: true,
        [RESOURCE_KEYS.USER_MANAGEMENT.SYSTEM_ROLES]: true,
    },
    write: {
        [RESOURCE_KEYS.SITE.POSTS]: true,
        [RESOURCE_KEYS.USER_MANAGEMENT.SYSTEM_ROLES]: true,
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

const enterpriseAdvancedLicense = {
    IsLicensed: 'true',
    SkuShortName: LicenseSkus.EnterpriseAdvanced,
} as ClientLicense;

const entryLicense = {
    IsLicensed: 'true',
    SkuShortName: LicenseSkus.Entry,
} as ClientLicense;

type CustomAdminDefinitionSetting = Extract<AdminDefinitionSetting, {type: 'custom'}>;

function isHidden(subsection: AdminDefinitionSubSection, config: Partial<AdminConfig>, license: ClientLicense) {
    const check = subsection.isHidden as Extract<Check, (...args: any[]) => boolean>;
    return check(config, {}, license, true, consoleAccess);
}

function isDisabled(check: Check | undefined, access: ConsoleAccess) {
    const disabledCheck = check as Extract<Check, (...args: any[]) => boolean>;
    return disabledCheck(contentFlaggingConfigEnabled, {}, professionalLicense, true, access);
}

describe('AdminDefinition - Data Spillage discovery', () => {
    const settingsSubsection = AdminDefinition.site.subsections.content_flagging;
    const discoverySubsection = AdminDefinition.site.subsections.content_flagging_feature_discovery;

    test('includes a discovery route at the Data Spillage URL', () => {
        expect(discoverySubsection).toBeDefined();
        expect(discoverySubsection.url).toBe(settingsSubsection.url);
        expect(discoverySubsection.isDiscovery).toBe(true);
        expect(discoverySubsection.title).toEqual(settingsSubsection.title);
        expect(discoverySubsection.restrictedIndicator).toBeDefined();

        const schema = discoverySubsection.schema;
        expect('name' in schema ? schema.name : undefined).toEqual(settingsSubsection.title);
    });

    test('shows discovery instead of settings for Professional licenses', () => {
        const siteSectionHiddenCheck = AdminDefinition.site.isHidden as Extract<Check, (...args: any[]) => boolean>;

        expect(siteSectionHiddenCheck(contentFlaggingConfigEnabled, {}, professionalLicense, true, consoleAccess)).toBe(false);
        expect(isHidden(settingsSubsection, contentFlaggingConfigEnabled, professionalLicense)).toBe(true);
        expect(isHidden(discoverySubsection, contentFlaggingConfigEnabled, professionalLicense)).toBe(false);
    });

    test('shows settings instead of discovery for Enterprise Advanced licenses', () => {
        expect(isHidden(settingsSubsection, contentFlaggingConfigEnabled, enterpriseAdvancedLicense)).toBe(false);
        expect(isHidden(discoverySubsection, contentFlaggingConfigEnabled, enterpriseAdvancedLicense)).toBe(true);
    });

    test('hides discovery for Entry licenses', () => {
        expect(isHidden(discoverySubsection, contentFlaggingConfigEnabled, entryLicense)).toBe(true);
    });

    test('hides discovery when the Content Flagging feature flag is disabled', () => {
        expect(isHidden(settingsSubsection, contentFlaggingConfigDisabled, professionalLicense)).toBe(true);
        expect(isHidden(discoverySubsection, contentFlaggingConfigDisabled, professionalLicense)).toBe(true);
    });

    test('renders the Data Spillage feature discovery component through a custom setting', () => {
        const schema = discoverySubsection.schema;
        expect('settings' in schema).toBe(true);

        const settings = 'settings' in schema ? schema.settings ?? [] : [];
        const discoverySetting = settings.find((setting): setting is CustomAdminDefinitionSetting => (
            setting.type === 'custom' && setting.key === 'DataSpillageFeatureDiscovery'
        ));

        expect(discoverySetting).toBeDefined();
        expect(discoverySetting?.type).toBe('custom');
        expect(discoverySetting?.component).toBe(DataSpillageFeatureDiscovery);
        expect(isDisabled(discoverySetting?.isDisabled, consoleAccess)).toBe(false);
        expect(isDisabled(discoverySetting?.isDisabled, consoleAccessWithoutLicenseWrite)).toBe(true);
    });
});
