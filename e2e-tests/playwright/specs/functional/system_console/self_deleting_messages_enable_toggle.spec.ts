// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

import {getBurnOnReadSettings, gotoPostSettings, skipIfNotAdvancedLicense} from './support';

test.describe('System Console > Self-Deleting Messages', () => {
    test('admin can enable and disable self-deleting messages', async ({pw}) => {
        const {adminUser, adminClient} = await pw.initSetup();

        const license = await adminClient.getClientLicenseOld();
        skipIfNotAdvancedLicense(license);

        if (!adminUser) {
            throw new Error('Failed to create admin user');
        }

        // # Log in as admin
        const {systemConsolePage, page} = await pw.testBrowser.login(adminUser);

        // # Visit system console
        await systemConsolePage.goto();
        await systemConsolePage.toBeVisible();

        // # Navigate to Posts section
        await gotoPostSettings(systemConsolePage, page);

        // * Verify Posts section is visible
        const {postsSection, enableToggleTrue, enableToggleFalse, durationDropdown, maxTTLDropdown, saveButton} =
            getBurnOnReadSettings(page);
        await expect(postsSection).toBeVisible();

        // # If feature is enabled, disable it first
        if (await enableToggleTrue.isChecked()) {
            await enableToggleFalse.click();
            await saveButton.click();
            await pw.waitUntil(async () => (await saveButton.textContent()) === 'Save');
        }

        // * Verify dropdowns are disabled when feature is off
        expect(await durationDropdown.isDisabled()).toBe(true);
        expect(await maxTTLDropdown.isDisabled()).toBe(true);

        // # Enable the feature
        await enableToggleTrue.click();

        // * Verify feature is enabled
        expect(await enableToggleTrue.isChecked()).toBe(true);

        // * Verify dropdowns are now enabled
        expect(await durationDropdown.isDisabled()).toBe(false);
        expect(await maxTTLDropdown.isDisabled()).toBe(false);

        // # Save settings
        await saveButton.click();
        await pw.waitUntil(async () => (await saveButton.textContent()) === 'Save');

        // # Navigate away and back to verify persistence
        await systemConsolePage.sidebar.userManagement.users.click();
        await systemConsolePage.users.toBeVisible();
        await systemConsolePage.sidebar.siteConfiguration.posts.click();
        await page.waitForLoadState('networkidle');

        // * Verify feature is still enabled
        expect(await enableToggleTrue.isChecked()).toBe(true);
    });

    test('dropdowns are disabled when feature is disabled', async ({pw}) => {
        const {adminUser, adminClient} = await pw.initSetup();

        const license = await adminClient.getClientLicenseOld();
        skipIfNotAdvancedLicense(license);

        if (!adminUser) {
            throw new Error('Failed to create admin user');
        }

        // # Disable BoR via API to start with a known state
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

        const {enableToggleTrue, enableToggleFalse, durationDropdown, maxTTLDropdown} = getBurnOnReadSettings(page);

        // * Verify feature is disabled (from API config)
        expect(await enableToggleFalse.isChecked()).toBe(true);

        // * Verify dropdowns are disabled when feature is off
        expect(await durationDropdown.isDisabled()).toBe(true);
        expect(await maxTTLDropdown.isDisabled()).toBe(true);

        // # Enable the feature (just toggle, don't save)
        await enableToggleTrue.click();

        // * Verify dropdowns are now enabled
        expect(await durationDropdown.isDisabled()).toBe(false);
        expect(await maxTTLDropdown.isDisabled()).toBe(false);

        // # Toggle back to disabled
        await enableToggleFalse.click();

        // * Verify dropdowns are disabled again
        expect(await durationDropdown.isDisabled()).toBe(true);
        expect(await maxTTLDropdown.isDisabled()).toBe(true);
    });

    test('settings persist after page reload', async ({pw}) => {
        const {adminUser, adminClient} = await pw.initSetup();

        const license = await adminClient.getClientLicenseOld();
        skipIfNotAdvancedLicense(license);

        if (!adminUser) {
            throw new Error('Failed to create admin user');
        }

        // # Configure BoR via API with specific values (using valid dropdown options)
        // Duration: 300 (5 minutes), Max TTL: 259200 (3 days)
        const config = await adminClient.getConfig();
        config.ServiceSettings.EnableBurnOnRead = true;
        config.ServiceSettings.BurnOnReadDurationSeconds = 300;
        config.ServiceSettings.BurnOnReadMaximumTimeToLiveSeconds = 259200;
        await adminClient.patchConfig(config);

        // # Log in as admin
        const {systemConsolePage, page} = await pw.testBrowser.login(adminUser);

        // # Visit system console
        await systemConsolePage.goto();
        await systemConsolePage.toBeVisible();

        // # Navigate to Posts section
        await gotoPostSettings(systemConsolePage, page);

        const {enableToggleTrue, durationDropdown, maxTTLDropdown} = getBurnOnReadSettings(page);

        // * Verify configured values are displayed
        expect(await enableToggleTrue.isChecked()).toBe(true);
        expect(await durationDropdown.inputValue()).toBe('300');
        expect(await maxTTLDropdown.inputValue()).toBe('259200');

        // # Reload directly to Posts section
        await page.goto('/admin_console/site_config/posts');
        await page.waitForLoadState('networkidle');

        // * Verify values persist after reload
        expect(await enableToggleTrue.isChecked()).toBe(true);
        expect(await durationDropdown.inputValue()).toBe('300');
        expect(await maxTTLDropdown.inputValue()).toBe('259200');
    });
});
