// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {AdminConfig} from '@mattermost/types/config';

import {LicenseSkus} from 'utils/constants';

import AdminDefinition from './admin_definition';
import type {AdminDefinitionSetting, AdminDefinitionConfigSchemaSection} from './types';

describe('AdminDefinition - Mobile Ephemeral Mode Settings', () => {
    const getEphemeralModeSections = () => {
        const mobileSecuritySection = AdminDefinition.environment.subsections.mobile_security;
        const sections = 'sections' in mobileSecuritySection.schema! ? mobileSecuritySection.schema.sections : undefined;
        return sections;
    };

    const getEphemeralModeSection = () => {
        const sections = getEphemeralModeSections();
        return sections?.find((section: AdminDefinitionConfigSchemaSection) => section.key === 'MobileSecuritySettings.EphemeralMode');
    };

    const getEphemeralModeSettings = () => {
        const section = getEphemeralModeSection();
        return section?.settings || [];
    };

    test('should include Mobile Ephemeral Mode section in mobile_security', () => {
        const section = getEphemeralModeSection();
        expect(section).toBeDefined();
    });

    test('should include Enable setting', () => {
        const settings = getEphemeralModeSettings();
        const enableSetting = settings.find((s: AdminDefinitionSetting) => s.key === 'MobileEphemeralModeSettings.Enable');

        expect(enableSetting).toBeDefined();
        expect(enableSetting?.type).toBe('bool');
        expect(enableSetting?.label).toBeDefined();
        expect(enableSetting?.help_text).toBeDefined();
    });

    test('should include info banner', () => {
        const settings = getEphemeralModeSettings();
        const bannerSetting = settings.find((s: AdminDefinitionSetting) => s.type === 'banner');

        expect(bannerSetting).toBeDefined();
    });

    test('settings should have proper translation message descriptors', () => {
        const settings = getEphemeralModeSettings();
        const settingsWithLabels = settings.filter((s: AdminDefinitionSetting) => s.key?.includes('MobileEphemeralMode'));

        settingsWithLabels.forEach((setting: AdminDefinitionSetting) => {
            if (setting.label && typeof setting.label === 'object') {
                expect('id' in setting.label).toBe(true);
                expect('defaultMessage' in setting.label).toBe(true);
            }

            if (setting.help_text && typeof setting.help_text === 'object' && !('$$typeof' in setting.help_text)) {
                expect('id' in setting.help_text).toBe(true);
                expect('defaultMessage' in setting.help_text).toBe(true);
            }
        });
    });

    test('should use LicensedSectionContainer with Enterprise Advanced', () => {
        const section = getEphemeralModeSection();

        expect(section?.component).toBeDefined();
        expect(section?.license_sku).toBe(LicenseSkus.EnterpriseAdvanced);
        expect(section?.componentProps).toBeDefined();
        expect(section?.componentProps?.requiredSku).toBe(LicenseSkus.EnterpriseAdvanced);
        expect(section?.componentProps?.featureDiscoveryConfig).toBeDefined();
        expect(section?.componentProps?.featureDiscoveryConfig?.featureName).toBe('mobile_ephemeral_mode');
        expect(section?.componentProps?.featureDiscoveryConfig?.learnMoreURL).toBe(
            'https://docs.mattermost.com/configure/environment-configuration-settings.html#mobile-security',
        );
    });

    test('isHidden should return true when feature flag is disabled', () => {
        const section = getEphemeralModeSection();
        expect(section?.isHidden).toBeDefined();
        expect(typeof section?.isHidden).toBe('function');

        const mockConfig: Partial<AdminConfig> = {FeatureFlags: {MobileEphemeralMode: false}};
        const isHiddenFn = section!.isHidden as (config: Partial<AdminConfig>) => boolean;
        expect(isHiddenFn(mockConfig)).toBe(true);
    });

    test('isHidden should return false when feature flag is enabled', () => {
        const section = getEphemeralModeSection();

        const mockConfig: Partial<AdminConfig> = {FeatureFlags: {MobileEphemeralMode: true}};
        const isHiddenFn = section!.isHidden as (config: Partial<AdminConfig>) => boolean;
        expect(isHiddenFn(mockConfig)).toBe(false);
    });

    test('should include DisconnectionTimeoutSeconds number setting', () => {
        const settings = getEphemeralModeSettings();
        const setting = settings.find((s: AdminDefinitionSetting) => s.key === 'MobileEphemeralModeSettings.DisconnectionTimeoutSeconds');

        expect(setting).toBeDefined();
        expect(setting?.type).toBe('number');
        expect(setting?.isDisabled).toBeDefined();
    });

    test('should include OfflinePersistenceTimerHours number setting', () => {
        const settings = getEphemeralModeSettings();
        const setting = settings.find((s: AdminDefinitionSetting) => s.key === 'MobileEphemeralModeSettings.OfflinePersistenceTimerHours');

        expect(setting).toBeDefined();
        expect(setting?.type).toBe('number');
        expect(setting?.isDisabled).toBeDefined();
    });

    test('should include AutoCacheCleanupDays number setting', () => {
        const settings = getEphemeralModeSettings();
        const setting = settings.find((s: AdminDefinitionSetting) => s.key === 'MobileEphemeralModeSettings.AutoCacheCleanupDays');

        expect(setting).toBeDefined();
        expect(setting?.type).toBe('number');
        expect(setting?.isDisabled).toBeDefined();
    });

    test('OfflinePersistenceTimerHours should have disabled_help_text for zero-persistence mode', () => {
        const settings = getEphemeralModeSettings();
        const setting = settings.find((s: AdminDefinitionSetting) => s.key === 'MobileEphemeralModeSettings.OfflinePersistenceTimerHours');

        expect(setting?.disabled_help_text).toBeDefined();
    });
});
