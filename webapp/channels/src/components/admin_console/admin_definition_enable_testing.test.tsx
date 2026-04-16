// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import AdminDefinition from './admin_definition';
import type {AdminDefinitionSetting, AdminDefinitionSettingBanner} from './types';

describe('AdminDefinition - Enable Testing setting', () => {
    const getDeveloperSettings = () => {
        const developerSection = AdminDefinition.environment.subsections.developer;
        const schema = developerSection?.schema;

        return (schema && 'settings' in schema && schema.settings) ? schema.settings : [];
    };

    test('includes a warning banner before the EnableTesting setting', () => {
        const settings = getDeveloperSettings();
        const bannerIndex = settings.findIndex((setting: AdminDefinitionSetting) => setting.type === 'banner');
        const enableTestingIndex = settings.findIndex((setting: AdminDefinitionSetting) => setting.key === 'ServiceSettings.EnableTesting');

        expect(bannerIndex).toBeGreaterThanOrEqual(0);
        expect(enableTestingIndex).toBeGreaterThanOrEqual(0);
        expect(bannerIndex).toBeLessThan(enableTestingIndex);

        const banner = settings[bannerIndex] as AdminDefinitionSettingBanner;
        expect(banner.banner_type).toBe('warning');
        expect(typeof banner.label).toBe('object');
        if (banner.label && typeof banner.label === 'object') {
            expect(banner.label).toMatchObject({
                id: 'admin.service.testingWarning',
                defaultMessage: expect.stringContaining('Never enable this setting in production.'),
            });
        }
    });

    test('has explicit non-production guidance in the EnableTesting help text', () => {
        const settings = getDeveloperSettings();
        const setting = settings.find((item: AdminDefinitionSetting) => item.key === 'ServiceSettings.EnableTesting');

        expect(setting).toBeDefined();
        expect(setting?.type).toBe('bool');
        expect(setting?.help_text).toBeDefined();
        expect(typeof setting?.help_text).toBe('object');
        expect(setting?.help_text).toMatchObject({
            id: 'admin.service.testingDescription',
            defaultMessage: expect.stringContaining('never in production'),
        });
    });
});
