// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {AdminConfig} from '@mattermost/types/config';

import {LicenseSkus} from 'utils/constants';

import AdminDefinition from './admin_definition';
import type {AdminDefinitionSetting, AdminDefinitionConfigSchemaSection} from './types';

describe('AdminDefinition - Burn-on-Read Settings', () => {
    // Helper function to get all settings from all sections
    const getAllSettings = () => {
        const postsSection = AdminDefinition.site.subsections.posts;
        const sections = 'sections' in postsSection.schema! ? postsSection.schema.sections : undefined;

        // Flatten all settings from all sections
        const allSettings = sections?.flatMap((section: any) => section.settings || []) || [];
        return allSettings;
    };

    test('should include Burn-on-Read settings in posts section', () => {
        const postsSection = AdminDefinition.site.subsections.posts;
        expect(postsSection).toBeDefined();

        const allSettings = getAllSettings();
        expect(allSettings.length).toBeGreaterThan(0);

        // Find Burn-on-Read settings
        const enableSetting = allSettings.find((s: AdminDefinitionSetting) => s.key === 'ServiceSettings.EnableBurnOnRead');
        const durationSetting = allSettings.find((s: AdminDefinitionSetting) => s.key === 'ServiceSettings.BurnOnReadDurationSeconds');

        expect(enableSetting).toBeDefined();
        expect(durationSetting).toBeDefined();
    });

    test('EnableBurnOnRead setting should have correct configuration', () => {
        const allSettings = getAllSettings();
        const enableSetting = allSettings.find((s: AdminDefinitionSetting) => s.key === 'ServiceSettings.EnableBurnOnRead');

        expect(enableSetting?.type).toBe('bool');
        expect(enableSetting?.label).toBeDefined();
        expect(enableSetting?.help_text).toBeDefined();
    });

    test('BurnOnReadDurationSeconds setting should have correct options', () => {
        const allSettings = getAllSettings();
        const durationSetting = allSettings.find((s: AdminDefinitionSetting) => s.key === 'ServiceSettings.BurnOnReadDurationSeconds');

        expect(durationSetting?.type).toBe('dropdown');
        expect(durationSetting?.onConfigLoad).toBeDefined();

        // Test that onConfigLoad returns default value when no value is provided
        if ('onConfigLoad' in durationSetting! && durationSetting.onConfigLoad) {
            expect(durationSetting.onConfigLoad(null, {})).toBe('600');
            expect(durationSetting.onConfigLoad(undefined, {})).toBe('600');
            expect(durationSetting.onConfigLoad('300', {})).toBe('300');
        }

        // Check that all expected duration options are present (in seconds)
        if ('options' in durationSetting!) {
            const options = durationSetting.options;
            const optionValues = options?.map((opt: any) => opt.value);

            expect(optionValues).toContain('60'); // 1 minute
            expect(optionValues).toContain('300'); // 5 minutes
            expect(optionValues).toContain('600'); // 10 minutes (default)
            expect(optionValues).toContain('1800'); // 30 minutes
            expect(optionValues).toContain('3600'); // 1 hour
            expect(optionValues).toContain('28800'); // 8 hours
        }
    });

    test('all Burn-on-Read settings should have proper permission checks', () => {
        const allSettings = getAllSettings();
        const burnOnReadSettings = allSettings.filter((s: AdminDefinitionSetting) =>
            s.key?.includes('BurnOnRead'),
        );

        // All settings should check for posts write permission
        burnOnReadSettings.forEach((setting: AdminDefinitionSetting) => {
            expect(setting.isDisabled).toBeDefined();

            // The permission check should be a function that checks write permissions
            expect(typeof setting.isDisabled).toBe('function');
        });
    });

    test('settings should have proper translation message descriptors', () => {
        const allSettings = getAllSettings();
        const burnOnReadSettings = allSettings.filter((s: AdminDefinitionSetting) =>
            s.key?.includes('BurnOnRead'),
        );

        burnOnReadSettings.forEach((setting: AdminDefinitionSetting) => {
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

    test('Burn-on-Read section should use LicensedSectionContainer with proper feature discovery', () => {
        const postsSection = AdminDefinition.site.subsections.posts;
        const sections = 'sections' in postsSection.schema! ? postsSection.schema.sections : undefined;

        // Find the Burn-on-Read section
        const burnOnReadSection = sections?.find((section: AdminDefinitionConfigSchemaSection) => section.key === 'PostSettings.BurnOnRead');
        expect(burnOnReadSection).toBeDefined();

        // Check that the section uses LicensedSectionContainer
        expect(burnOnReadSection?.component).toBeDefined();

        // Check that it has proper license SKU requirement
        expect(burnOnReadSection?.license_sku).toBe(LicenseSkus.EnterpriseAdvanced);

        // Check that component props include feature discovery config
        expect(burnOnReadSection?.componentProps).toBeDefined();
        expect(burnOnReadSection?.componentProps?.requiredSku).toBe(LicenseSkus.EnterpriseAdvanced);
        expect(burnOnReadSection?.componentProps?.featureDiscoveryConfig).toBeDefined();
        expect(burnOnReadSection?.componentProps?.featureDiscoveryConfig?.featureName).toBe('burn_on_read');
    });

    test('Burn-on-Read section isHidden should return true when feature flag is disabled', () => {
        const postsSection = AdminDefinition.site.subsections.posts;
        const sections = 'sections' in postsSection.schema! ? postsSection.schema.sections : undefined;

        // Find the Burn-on-Read section
        const burnOnReadSection = sections?.find((section: AdminDefinitionConfigSchemaSection) => section.key === 'PostSettings.BurnOnRead');
        expect(burnOnReadSection).toBeDefined();

        // Check that isHidden is defined and is a function
        expect(burnOnReadSection?.isHidden).toBeDefined();
        expect(typeof burnOnReadSection?.isHidden).toBe('function');

        // Test that isHidden function returns true when feature flag is false
        const mockConfigDisabled: Partial<AdminConfig> = {FeatureFlags: {BurnOnRead: false}};
        const isHiddenFn = burnOnReadSection!.isHidden as (config: Partial<AdminConfig>) => boolean;
        expect(isHiddenFn(mockConfigDisabled)).toBe(true);
    });

    test('Burn-on-Read section isHidden should return false when feature flag is enabled', () => {
        const postsSection = AdminDefinition.site.subsections.posts;
        const sections = 'sections' in postsSection.schema! ? postsSection.schema.sections : undefined;

        // Find the Burn-on-Read section
        const burnOnReadSection = sections?.find((section: AdminDefinitionConfigSchemaSection) => section.key === 'PostSettings.BurnOnRead');
        expect(burnOnReadSection).toBeDefined();

        // Test that isHidden function returns false when feature flag is true
        const mockConfigEnabled: Partial<AdminConfig> = {FeatureFlags: {BurnOnRead: true}};
        const isHiddenFn = burnOnReadSection!.isHidden as (config: Partial<AdminConfig>) => boolean;
        expect(isHiddenFn(mockConfigEnabled)).toBe(false);
    });
});
