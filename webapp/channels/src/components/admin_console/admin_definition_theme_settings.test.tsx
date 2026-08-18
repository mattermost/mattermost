// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {AdminConfig} from '@mattermost/types/config';

import AdminDefinition from './admin_definition';
import SchemaAdminSettings, {getConfigFromState} from './schema_admin_settings';
import type {AdminDefinitionSetting, AdminDefinitionSettingInput, AdminDefinitionSubSectionSchema} from './types';

const customizationSchema = AdminDefinition.site.subsections.customization.schema as AdminDefinitionSubSectionSchema;

const customizationSettings = ('settings' in customizationSchema && customizationSchema.settings) ? customizationSchema.settings : [];

const experimentalSchema = AdminDefinition.experimental.subsections.experimental_features.schema;
const experimentalSettings = (experimentalSchema && 'settings' in experimentalSchema && experimentalSchema.settings) ? experimentalSchema.settings : [];

const findSetting = (settings: AdminDefinitionSetting[], key: string) => settings.find((setting) => setting.key === key);

// getStateFromConfig is a static hoisted through injectIntl, so it isn't visible on the exported type.
const {getStateFromConfig} = SchemaAdminSettings as unknown as {
    getStateFromConfig: (config: Partial<AdminConfig>, schema: AdminDefinitionSubSectionSchema) => Record<string, unknown>;
};

describe('AdminDefinition - graduated theme and onboarding settings', () => {
    const graduatedKeys = [
        'ThemeSettings.EnableThemeSelection',
        'ThemeSettings.AllowCustomThemes',
        'ThemeSettings.AllowedThemes',
        'ThemeSettings.DefaultTheme',
        'ServiceSettings.EnableTutorial',
        'ServiceSettings.EnableOnboardingFlow',
    ];

    test.each(graduatedKeys)('%s is defined on Site Configuration > Customization', (key) => {
        expect(findSetting(customizationSettings, key)).toBeDefined();
    });

    test.each(graduatedKeys)('%s is no longer defined under Experimental > Features', (key) => {
        expect(findSetting(experimentalSettings, key)).toBeUndefined();
    });

    test('AllowedThemes round-trips through the admin console as a string array', () => {
        const setting = findSetting(customizationSettings, 'ThemeSettings.AllowedThemes') as AdminDefinitionSettingInput;

        expect(setting.type).toBe('text');
        expect(setting.multiple).toBe(true);

        const schema = {...customizationSchema, settings: [setting]} as AdminDefinitionSubSectionSchema;

        const state = getStateFromConfig(
            {ThemeSettings: {AllowedThemes: ['denim', 'onyx']}} as unknown as Partial<AdminConfig>,
            schema,
        );
        expect(state['ThemeSettings.AllowedThemes']).toEqual(['denim', 'onyx']);

        const config = getConfigFromState(
            {ThemeSettings: {AllowedThemes: []}} as unknown as Partial<AdminConfig>,
            state,
            schema,
            () => false,
        );
        expect(config.ThemeSettings?.AllowedThemes).toEqual(['denim', 'onyx']);
    });
});
