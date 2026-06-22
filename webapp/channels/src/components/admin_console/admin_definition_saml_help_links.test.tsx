// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import AdminDefinition from './admin_definition';
import type {AdminDefinitionSetting} from './types';

type AdminDefinitionSettingDropdown = Extract<AdminDefinitionSetting, {type: 'dropdown'}>;

describe('AdminDefinition - SAML algorithm help text links', () => {
    const getSamlSettings = (): AdminDefinitionSetting[] => {
        const samlSection = AdminDefinition.authentication.subsections.saml;
        const settings = 'settings' in samlSection.schema! ? samlSection.schema.settings : undefined;

        return settings || [];
    };

    const getDropdownSetting = (key: string): AdminDefinitionSettingDropdown => {
        const setting = getSamlSettings().find((s) => s.key === key);

        expect(setting).toBeDefined();
        expect(setting?.type).toBe('dropdown');

        return setting as AdminDefinitionSettingDropdown;
    };

    it.each([
        'SamlSettings.SignatureAlgorithm',
        'SamlSettings.CanonicalAlgorithm',
    ])('renders %s option help text as markdown links so the URLs are clickable', (key) => {
        const setting = getDropdownSetting(key);

        expect(setting.options.length).toBeGreaterThan(0);

        for (const option of setting.options) {
            expect(option.help_text).toBeDefined();
            expect(option.help_text_markdown).toBe(true);

            const message = option.help_text as {defaultMessage: string};

            // The W3C spec URL must be wrapped in markdown link syntax [url](url)
            // so it renders as an anchor instead of plain, non-clickable text.
            expect(message.defaultMessage).toMatch(/\[https?:\/\/[^\]]+]\(https?:\/\/[^)]+\)/);
        }
    });
});
