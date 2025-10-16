// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import AdminDefinition from './admin_definition';
import type {AdminDefinitionSetting} from './types';

describe('AdminDefinition - Burn-on-Read Settings', () => {
    test('should include Burn-on-Read settings in posts section', () => {
        const postsSection = AdminDefinition.site.subsections.posts;
        expect(postsSection).toBeDefined();

        const postsSettings = 'settings' in postsSection.schema! ? postsSection.schema.settings : undefined;
        expect(postsSettings).toBeDefined();

        // Find Burn-on-Read settings
        const enableSetting = postsSettings?.find((s: AdminDefinitionSetting) => s.key === 'ServiceSettings.EnableBurnOnRead');
        const durationSetting = postsSettings?.find((s: AdminDefinitionSetting) => s.key === 'ServiceSettings.BurnOnReadDurationMinutes');
        const allowedUsersSetting = postsSettings?.find((s: AdminDefinitionSetting) => s.key === 'ServiceSettings.BurnOnReadAllowedUsers');
        const usersListSetting = postsSettings?.find((s: AdminDefinitionSetting) => s.key === 'ServiceSettings.BurnOnReadAllowedUsersList');

        expect(enableSetting).toBeDefined();
        expect(durationSetting).toBeDefined();
        expect(allowedUsersSetting).toBeDefined();
        expect(usersListSetting).toBeDefined();
    });

    test('EnableBurnOnRead setting should have correct configuration', () => {
        const postsSection = AdminDefinition.site.subsections.posts;
        const postsSettings = 'settings' in postsSection.schema! ? postsSection.schema.settings : undefined;
        const enableSetting = postsSettings?.find((s: AdminDefinitionSetting) => s.key === 'ServiceSettings.EnableBurnOnRead');

        expect(enableSetting?.type).toBe('bool');
        expect(enableSetting?.label).toBeDefined();
        expect(enableSetting?.help_text).toBeDefined();
    });

    test('BurnOnReadDurationMinutes setting should have correct options', () => {
        const postsSection = AdminDefinition.site.subsections.posts;
        const postsSettings = 'settings' in postsSection.schema! ? postsSection.schema.settings : undefined;
        const durationSetting = postsSettings?.find((s: AdminDefinitionSetting) => s.key === 'ServiceSettings.BurnOnReadDurationMinutes');

        expect(durationSetting?.type).toBe('dropdown');
        expect(durationSetting?.onConfigLoad).toBeDefined();

        // Test that onConfigLoad returns default value when no value is provided
        if ('onConfigLoad' in durationSetting! && durationSetting.onConfigLoad) {
            expect(durationSetting.onConfigLoad(null, {})).toBe('10');
            expect(durationSetting.onConfigLoad(undefined, {})).toBe('10');
            expect(durationSetting.onConfigLoad('5', {})).toBe('5');
        }

        // Check that all expected duration options are present
        if ('options' in durationSetting!) {
            const options = durationSetting.options;
            const optionValues = options?.map((opt: any) => opt.value);

            expect(optionValues).toContain('1'); // 1 minute
            expect(optionValues).toContain('5'); // 5 minutes
            expect(optionValues).toContain('10'); // 10 minutes (default)
            expect(optionValues).toContain('30'); // 30 minutes
            expect(optionValues).toContain('60'); // 1 hour
            expect(optionValues).toContain('480'); // 8 hours
        }
    });

    test('BurnOnReadAllowedUsers setting should have correct radio options', () => {
        const postsSection = AdminDefinition.site.subsections.posts;
        const postsSettings = 'settings' in postsSection.schema! ? postsSection.schema.settings : undefined;
        const allowedUsersSetting = postsSettings?.find((s: AdminDefinitionSetting) => s.key === 'ServiceSettings.BurnOnReadAllowedUsers');

        expect(allowedUsersSetting?.type).toBe('radio');
        expect(allowedUsersSetting?.onConfigLoad).toBeDefined();

        // Check that all expected radio options are present
        if ('options' in allowedUsersSetting!) {
            const options = allowedUsersSetting.options;
            const optionValues = options?.map((opt: any) => opt.value);

            expect(optionValues).toContain('all');
            expect(optionValues).toContain('allow_selected');
            expect(optionValues).toContain('block_selected');
        }
    });

    test('BurnOnReadAllowedUsersList setting should be custom component', () => {
        const postsSection = AdminDefinition.site.subsections.posts;
        const postsSettings = 'settings' in postsSection.schema! ? postsSection.schema.settings : undefined;
        const usersListSetting = postsSettings?.find((s: AdminDefinitionSetting) => s.key === 'ServiceSettings.BurnOnReadAllowedUsersList');

        expect(usersListSetting?.type).toBe('custom');
        if (usersListSetting && 'component' in usersListSetting) {
            expect(usersListSetting.component).toBeDefined();
        }
        expect(usersListSetting?.label).toBeDefined();
        expect(usersListSetting?.help_text).toBeDefined();
    });

    test('all Burn-on-Read settings should have proper permission checks', () => {
        const postsSection = AdminDefinition.site.subsections.posts;
        const postsSettings = 'settings' in postsSection.schema! ? postsSection.schema.settings : undefined;

        const burnOnReadSettings = postsSettings?.filter((s: AdminDefinitionSetting) =>
            s.key?.includes('BurnOnRead'),
        );

        // All settings should check for posts write permission
        burnOnReadSettings?.forEach((setting: AdminDefinitionSetting) => {
            expect(setting.isDisabled).toBeDefined();

            // The permission check should be a function that checks write permissions
            expect(typeof setting.isDisabled).toBe('function');
        });
    });

    test('settings should have proper translation message descriptors', () => {
        const postsSection = AdminDefinition.site.subsections.posts;
        const postsSettings = 'settings' in postsSection.schema! ? postsSection.schema.settings : undefined;

        const burnOnReadSettings = postsSettings?.filter((s: AdminDefinitionSetting) =>
            s.key?.includes('BurnOnRead'),
        );

        burnOnReadSettings?.forEach((setting: AdminDefinitionSetting) => {
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

    test('all Burn-on-Read settings should have proper feature flag checks', () => {
        const postsSection = AdminDefinition.site.subsections.posts;
        const postsSettings = 'settings' in postsSection.schema! ? postsSection.schema.settings : undefined;

        const mainBurnOnReadSettings = postsSettings?.filter((s: AdminDefinitionSetting) =>
            s.key?.includes('BurnOnRead') && s.key !== 'ServiceSettings.BurnOnReadAllowedUsersList',
        );

        // Main settings should be hidden without feature flag
        mainBurnOnReadSettings?.forEach((setting: AdminDefinitionSetting) => {
            expect(setting.isHidden).toBeDefined();
            expect(typeof setting.isHidden).toBe('function');

            if (setting.isHidden && typeof setting.isHidden === 'function') {
                // Test with feature flag disabled
                const configDisabled = {FeatureFlags: {BurnOnRead: false}} as any;
                expect(setting.isHidden(configDisabled, {}, {})).toBe(true);

                // Test with feature flag enabled
                const configEnabled = {FeatureFlags: {BurnOnRead: true}} as any;
                expect(setting.isHidden(configEnabled, {}, {})).toBe(false);
            }
        });

        // User selector should have complex visibility logic including feature flag
        const usersListSetting = postsSettings?.find((s: AdminDefinitionSetting) => s.key === 'ServiceSettings.BurnOnReadAllowedUsersList');
        expect(usersListSetting?.isHidden).toBeDefined();
        expect(typeof usersListSetting?.isHidden).toBe('function');
    });
});
