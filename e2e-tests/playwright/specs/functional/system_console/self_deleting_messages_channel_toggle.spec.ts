// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

import {getBurnOnReadSettings, gotoPostSettings, skipIfNotAdvancedLicense} from './support';

test.describe('System Console > Self-Deleting Messages', () => {
    test('BoR toggle appears in channels when feature is enabled in System Console', async ({pw}) => {
        const {adminUser, adminClient, team} = await pw.initSetup();

        const license = await adminClient.getClientLicenseOld();
        skipIfNotAdvancedLicense(license);

        if (!adminUser) {
            throw new Error('Failed to create admin user');
        }

        // # First, disable BoR via API to start clean
        const config = await adminClient.getConfig();
        config.ServiceSettings.EnableBurnOnRead = false;
        await adminClient.patchConfig(config);

        // # Log in as admin
        const {systemConsolePage, page} = await pw.testBrowser.login(adminUser);

        // # Visit system console
        await systemConsolePage.goto();
        await systemConsolePage.toBeVisible();

        // # Navigate to Posts section
        await gotoPostSettings(systemConsolePage, page);

        const {enableToggleTrue, saveButton} = getBurnOnReadSettings(page);

        // # Enable BoR feature
        await enableToggleTrue.click();
        await saveButton.click();
        await pw.waitUntil(async () => (await saveButton.textContent()) === 'Save');

        // # Navigate to Channels by going to the team URL
        await page.goto(`/${team.name}/channels/off-topic`);
        await page.waitForLoadState('networkidle');

        // * Verify BoR toggle is visible in post create area
        const borButton = page.getByRole('button', {name: /Burn-on-read/i});
        await expect(borButton).toBeVisible({timeout: 10000});
    });

    test('BoR toggle is hidden when feature is disabled in System Console', async ({pw}) => {
        const {adminUser, adminClient, team} = await pw.initSetup();

        const license = await adminClient.getClientLicenseOld();
        skipIfNotAdvancedLicense(license);

        if (!adminUser) {
            throw new Error('Failed to create admin user');
        }

        // # First, enable BoR via API
        const config = await adminClient.getConfig();
        config.ServiceSettings.EnableBurnOnRead = true;
        await adminClient.patchConfig(config);

        // # Log in as admin
        const {systemConsolePage, page} = await pw.testBrowser.login(adminUser);

        // # Visit system console
        await systemConsolePage.goto();
        await systemConsolePage.toBeVisible();

        // # Navigate to Posts section
        await gotoPostSettings(systemConsolePage, page);

        const {enableToggleFalse, saveButton} = getBurnOnReadSettings(page);

        // # Disable BoR feature
        await enableToggleFalse.click();
        await saveButton.click();
        await pw.waitUntil(async () => (await saveButton.textContent()) === 'Save');

        // # Navigate to Channels by going to the team URL
        await page.goto(`/${team.name}/channels/off-topic`);
        await page.waitForLoadState('networkidle');

        // * Verify BoR toggle is NOT visible in post create area
        const borButton = page.getByRole('button', {name: /Burn-on-read/i});
        await expect(borButton).not.toBeVisible({timeout: 5000});
    });
});
