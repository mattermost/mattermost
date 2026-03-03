// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    enableAutotranslationConfig,
    hasAutotranslationLicense,
    expect,
    test,
    SystemConsolePage,
} from '@mattermost/playwright-lib';
import {getRandomId} from 'utils/utils';

// Module-level variable to store the discovered translation service URL
// Set during translation-service probes and used by tests that need the service
let selectedTranslationUrl: string | null = null;

/**
 * Probe for available translation service (mock or real LibreTranslate)
 * Returns the first reachable service URL or null if none available
 */
async function probeTranslationService(): Promise<string | null> {
    const configuredUrl = process.env.LIBRETRANSLATE_URL;
    const defaultMockUrl = 'http://localhost:3010';
    const fallbackRealUrl = 'http://localhost:5000';

    // Try configured URL first (if provided)
    if (configuredUrl) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);

            try {
                // Try /health endpoint first (real LibreTranslate), then fallback to / (mock server)
                let res = await fetch(`${configuredUrl}/health`, {signal: controller.signal}).catch(() => null);
                if (!res?.ok) {
                    res = await fetch(`${configuredUrl}/`, {signal: controller.signal});
                }

                if (res?.ok) {
                    return configuredUrl;
                }
            } finally {
                clearTimeout(timeoutId);
            }
        } catch (error) {
            lastError = error instanceof Error ? error.message : String(error);
        }
    }

    // If no configured URL or it failed, try default mock server
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        try {
            const res = await fetch(`${defaultMockUrl}/`, {signal: controller.signal}).catch(() => null);
            if (res?.ok) {
                return defaultMockUrl;
            }
        } finally {
            clearTimeout(timeoutId);
        }
    } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
    }

    // If mock server not found, try real LibreTranslate
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        try {
            const res = await fetch(`${fallbackRealUrl}/health`, {signal: controller.signal}).catch(() => null);
            if (res?.ok) {
                return fallbackRealUrl;
            }
        } finally {
            clearTimeout(timeoutId);
        }
    } catch (_error) {
        // Service probe failed, will return null
    }

    return null;
}

test(
    'permission exists; Channel Administrators have Manage Channel Auto Translation ON',
    {
        tag: ['@autotranslation', '@permissions'],
    },
    async ({pw}) => {
        const {adminUser, adminClient} = await pw.initSetup();

        const license = await adminClient.getClientLicenseOld();
        test.skip(
            !hasAutotranslationLicense(license.SkuShortName),
            'Skipping test - server does not have Entry or Advanced license',
        );

        const {systemConsolePage} = await pw.testBrowser.login(adminUser);
        await systemConsolePage.goto();
        await systemConsolePage.toBeVisible();

        await gotoSystemSchemePage(systemConsolePage);

        const scheme = systemConsolePage.permissionsSystemScheme;
        await scheme.toBeVisible();

        await scheme.expectManageChannelAutoTranslationChecked(scheme.channelAdministratorsSection);
    },
);

test(
    'System Administrators have Manage Channel Auto Translation ON',
    {
        tag: ['@autotranslation', '@permissions'],
    },
    async ({pw}) => {
        const {adminUser, adminClient} = await pw.initSetup();

        const license = await adminClient.getClientLicenseOld();
        test.skip(
            !hasAutotranslationLicense(license.SkuShortName),
            'Skipping test - server does not have Entry or Advanced license',
        );

        const {systemConsolePage} = await pw.testBrowser.login(adminUser);
        await systemConsolePage.goto();
        await systemConsolePage.toBeVisible();

        await gotoSystemSchemePage(systemConsolePage);

        const scheme = systemConsolePage.permissionsSystemScheme;
        await scheme.toBeVisible();

        await scheme.expectManageChannelAutoTranslationChecked(scheme.systemAdministratorsSection);
    },
);

// Set up translation service probe only for the test that needs it
test.describe('autotranslation configuration tests', () => {
    test.beforeEach(async () => {
        // Only probe translation service for tests in this block that need it
        selectedTranslationUrl = await probeTranslationService();

        if (!selectedTranslationUrl) {
            test.skip(
                true,
                `Translation service not found. Please start one of the following:\n` +
                    `1. Mock server (recommended): npm run start:libretranslate-mock\n` +
                    `2. Real LibreTranslate: docker-compose -f ../docker-compose.autotranslation.yml up`,
            );
        }
    });

    test(
        'user without permission cannot enable autotranslation at channel level',
        {
            tag: ['@autotranslation', '@permissions'],
        },
        async ({pw}) => {
            const {adminClient, user, team} = await pw.initSetup();

            const license = await adminClient.getClientLicenseOld();
            test.skip(
                !hasAutotranslationLicense(license.SkuShortName),
                'Skipping test - server does not have Entry or Advanced license',
            );

            // Capture original config for restoration
            const originalConfig = await adminClient.getConfig();

            try {
                // Enable autotranslation
                await enableAutotranslationConfig(adminClient, {
                    mockBaseUrl: selectedTranslationUrl ?? process.env.LIBRETRANSLATE_URL ?? 'http://localhost:3010',
                    targetLanguages: ['en', 'es'],
                });

                const channelName = `autotranslation-perm-${await getRandomId()}`;
                const created = await adminClient.createChannel({
                    team_id: team.id,
                    name: channelName,
                    display_name: 'Permission Test Channel',
                    type: 'O',
                });
                await adminClient.addToChannel(user.id, created.id);

                const {channelsPage} = await pw.testBrowser.login(user);
                await channelsPage.goto(team.name, channelName);
                await channelsPage.toBeVisible();

                const channelSettingsModal = await channelsPage.openChannelSettings();
                const configTabVisible = await channelSettingsModal.configurationTab.isVisible();
                if (configTabVisible) {
                    const configurationTab = await channelSettingsModal.openConfigurationTab();
                    await expect(configurationTab.container.getByTestId('channelTranslationToggle-button')).not.toBeVisible();
                }
            } finally {
                // Restore original config to prevent state leakage
                await adminClient.updateConfig(originalConfig as any);
            }
        },
    );
});

async function gotoSystemSchemePage(systemConsolePage: SystemConsolePage) {
    await systemConsolePage.sidebar.userManagement.permissions.click();
    await systemConsolePage.page.waitForURL(/\/admin_console\/user_management\/permissions/);

    await systemConsolePage.page.getByRole('link', {name: 'Edit Scheme'}).click();
    await systemConsolePage.page.waitForURL(/\/admin_console\/user_management\/permissions\/system_scheme/);
}
