// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import AdminDefinition from './admin_definition';
import type {AdminDefinitionSetting} from './types';

describe('AdminDefinition - AllowDownloadLogs permission guard', () => {
    const getCustomizationSettings = () => {
        const customizationSection = AdminDefinition.site.subsections.customization;
        const schema = customizationSection?.schema;
        return (schema && 'settings' in schema && schema.settings) ? schema.settings : [];
    };

    test('AllowDownloadLogs setting should exist in customization section', () => {
        const settings = getCustomizationSettings();
        const setting = settings.find((s: AdminDefinitionSetting) => s.key === 'SupportSettings.AllowDownloadLogs');

        expect(setting).toBeDefined();
        expect(setting?.type).toBe('bool');
    });

    test('AllowDownloadLogs setting should have isDisabled write-permission guard', () => {
        const settings = getCustomizationSettings();
        const setting = settings.find((s: AdminDefinitionSetting) => s.key === 'SupportSettings.AllowDownloadLogs');

        expect(setting?.isDisabled).toBeDefined();
        expect(typeof setting?.isDisabled).toBe('function');
    });
});
