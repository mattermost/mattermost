// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import AdminDefinition from './admin_definition';
import type {AdminDefinitionSettingInput} from './types';

describe('AdminDefinition - OAuth Allowed Redirect URI Schemes', () => {
    const key = 'ServiceSettings.OAuthAllowedRedirectURISchemes';

    const getIntegrationManagementSettings = () => {
        const integrationsSection = AdminDefinition.integrations.subsections.integration_management;
        const schema = integrationsSection?.schema;
        return (schema && 'settings' in schema && schema.settings) ? schema.settings : [];
    };

    test('should include the setting in integration management as a multiple text input', () => {
        const setting = getIntegrationManagementSettings().find((s) => s.key === key);

        expect(setting).toBeDefined();
        expect(setting?.type).toBe('text');
        expect((setting as AdminDefinitionSettingInput)?.multiple).toBe(true);
    });

    test('should be placed after the DCR redirect URI allowlist', () => {
        const settings = getIntegrationManagementSettings();
        const dcrAllowlistIndex = settings.findIndex((s) => s.key === 'ServiceSettings.DCRRedirectURIAllowlist');
        const schemesIndex = settings.findIndex((s) => s.key === key);

        expect(dcrAllowlistIndex).toBeGreaterThanOrEqual(0);
        expect(schemesIndex).toBe(dcrAllowlistIndex + 1);
    });

    const writeAccess = {read: {}, write: {'integrations.integration_management': true}};
    const readOnlyAccess = {read: {}, write: {}};

    type DisabledCheck = (config: object, state: Record<string, boolean>, license: undefined, enterpriseReady: boolean, consoleAccess: object) => boolean;

    const getIsDisabled = () => {
        const setting = getIntegrationManagementSettings().find((s) => s.key === key);
        expect(typeof setting?.isDisabled).toBe('function');
        expect(typeof setting?.isHidden).toBe('function');
        return setting?.isDisabled as DisabledCheck;
    };

    test('should be disabled when the OAuth service provider is disabled', () => {
        const isDisabled = getIsDisabled();

        expect(isDisabled({}, {'ServiceSettings.EnableOAuthServiceProvider': true}, undefined, true, writeAccess)).toBe(false);
        expect(isDisabled({}, {'ServiceSettings.EnableOAuthServiceProvider': false}, undefined, true, writeAccess)).toBe(true);
    });

    test('should be disabled without write permission on integration management', () => {
        const isDisabled = getIsDisabled();

        expect(isDisabled({}, {'ServiceSettings.EnableOAuthServiceProvider': true}, undefined, true, readOnlyAccess)).toBe(true);
    });

    test('should not depend on dynamic client registration', () => {
        const isDisabled = getIsDisabled();

        for (const dcrEnabled of [true, false]) {
            expect(isDisabled({}, {
                'ServiceSettings.EnableOAuthServiceProvider': true,
                'ServiceSettings.EnableDynamicClientRegistration': dcrEnabled,
            }, undefined, true, writeAccess)).toBe(false);
        }
    });
});
