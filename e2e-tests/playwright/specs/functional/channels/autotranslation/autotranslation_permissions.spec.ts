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

test.beforeEach(async () => {
    // Verify translation service is running (mock server or real LibreTranslate)
    // The translation service is called on the server side, so we need the service running
    const configuredUrl = process.env.LIBRETRANSLATE_URL;
    const defaultMockUrl = 'http://localhost:3010';
    const fallbackRealUrl = 'http://localhost:5000';

    let selectedUrl: string | null = null;
    let lastError: string | null = null;

    // Try configured URL first (if provided)
    if (configuredUrl) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);

            // Try /health endpoint first (real LibreTranslate), then fallback to / (mock server)
            let res = await fetch(`${configuredUrl}/health`, {signal: controller.signal}).catch(() => null);
            if (!res?.ok) {
                res = await fetch(`${configuredUrl}/`, {signal: controller.signal});
            }

            clearTimeout(timeoutId);
            if (res?.ok) {
                selectedUrl = configuredUrl;
            }
        } catch (error) {
            lastError = error instanceof Error ? error.message : String(error);
        }
    }

    // If no configured URL or it failed, try default mock server
    if (!selectedUrl) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);
            const res = await fetch(`${defaultMockUrl}/`, {signal: controller.signal}).catch(() => null);
            clearTimeout(timeoutId);
            if (res?.ok) {
                selectedUrl = defaultMockUrl;
            }
        } catch (error) {
            lastError = error instanceof Error ? error.message : String(error);
        }
    }

    // If mock server not found, try real LibreTranslate
    if (!selectedUrl) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);
            const res = await fetch(`${fallbackRealUrl}/health`, {signal: controller.signal}).catch(() => null);
            clearTimeout(timeoutId);
            if (res?.ok) {
                selectedUrl = fallbackRealUrl;
            }
        } catch (error) {
            lastError = error instanceof Error ? error.message : String(error);
        }
    }

    if (!selectedUrl) {
        test.skip(
            true,
            `Translation service not found. Please start one of the following:\n` +
                `1. Mock server (recommended): npm run start:libretranslate-mock\n` +
                `2. Real LibreTranslate: docker-compose -f ../docker-compose.autotranslation.yml up\n` +
                `Error: ${lastError}`,
        );
    }
});

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

        await enableAutotranslationConfig(adminClient, {
            mockBaseUrl: process.env.LIBRETRANSLATE_URL || 'http://localhost:3010',
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
    },
);

async function gotoSystemSchemePage(systemConsolePage: SystemConsolePage) {
    await systemConsolePage.sidebar.userManagement.permissions.click();
    await systemConsolePage.page.waitForURL(/\/admin_console\/user_management\/permissions/);

    await systemConsolePage.page.getByRole('link', {name: 'Edit Scheme'}).click();
    await systemConsolePage.page.waitForURL(/\/admin_console\/user_management\/permissions\/system_scheme/);
}
