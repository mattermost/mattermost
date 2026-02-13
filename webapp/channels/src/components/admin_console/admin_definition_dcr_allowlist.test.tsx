// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import AdminDefinition from './admin_definition';
import type {AdminDefinitionSettingInput} from './types';

describe('AdminDefinition - DCR Redirect URI Allowlist', () => {
    const getIntegrationManagementSettings = () => {
        const integrationsSection = AdminDefinition.integrations.subsections.integration_management;
        const schema = integrationsSection?.schema;
        return (schema && 'settings' in schema && schema.settings) ? schema.settings : [];
    };

    test('should include DCR Redirect URI Allowlist setting in integration management', () => {
        const settings = getIntegrationManagementSettings();
        const allowlistSetting = settings.find((s) => s.key === 'ServiceSettings.DCRRedirectURIAllowlist');

        expect(allowlistSetting).toBeDefined();
        expect(allowlistSetting?.type).toBe('text');
        expect((allowlistSetting as AdminDefinitionSettingInput)?.multiple).toBe(true);
        expect(allowlistSetting?.key).toBe('ServiceSettings.DCRRedirectURIAllowlist');
    });

    test('DCR allowlist setting should be placed after EnableDynamicClientRegistration', () => {
        const settings = getIntegrationManagementSettings();
        const dcrIndex = settings.findIndex((s) => s.key === 'ServiceSettings.EnableDynamicClientRegistration');
        const allowlistIndex = settings.findIndex((s) => s.key === 'ServiceSettings.DCRRedirectURIAllowlist');

        expect(dcrIndex).toBeGreaterThanOrEqual(0);
        expect(allowlistIndex).toBe(dcrIndex + 1);
    });

    test('DCR allowlist setting should have correct disabled and hidden conditions', () => {
        const settings = getIntegrationManagementSettings();
        const allowlistSetting = settings.find((s) => s.key === 'ServiceSettings.DCRRedirectURIAllowlist');

        expect(allowlistSetting?.isDisabled).toBeDefined();
        expect(typeof allowlistSetting?.isDisabled).toBe('function');
        expect(allowlistSetting?.isHidden).toBeDefined();
        expect(typeof allowlistSetting?.isHidden).toBe('function');

        const isDisabled = allowlistSetting?.isDisabled as ((config: object, state: Record<string, boolean>) => boolean);
        expect(isDisabled({}, {
            'ServiceSettings.EnableOAuthServiceProvider': false,
            'ServiceSettings.EnableDynamicClientRegistration': true,
        })).toBe(true);
        expect(isDisabled({}, {
            'ServiceSettings.EnableOAuthServiceProvider': true,
            'ServiceSettings.EnableDynamicClientRegistration': false,
        })).toBe(true);
    });
});
