// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

test('should hide Intune MAM when Office365 is not configured', async ({pw}) => {
    const {adminUser, adminClient} = await pw.initSetup();

    const license = await adminClient.getClientLicenseOld();

    test.skip(license.SkuShortName !== 'advanced', 'Skipping test - server does not have enterprise advanced license');

    if (!adminUser) {
        throw new Error('Failed to create admin user');
    }

    // # Ensure Office365 is disabled
    const config = await adminClient.getConfig();
    config.Office365Settings.Enable = false;
    await adminClient.updateConfig(config);

    // # Log in as admin
    const {systemConsolePage} = await pw.testBrowser.login(adminUser);

    // # Visit system console
    await systemConsolePage.goto();
    await systemConsolePage.toBeVisible();

    // # Go to Mobile Security section
    await systemConsolePage.sidebar.mobileSecurity.click();

    // * Verify Intune MAM toggle is visible
    await expect(systemConsolePage.mobileSecurity.enableIntuneMAM.trueOption).toBeVisible();
    await expect(systemConsolePage.mobileSecurity.enableIntuneMAM.falseOption).toBeVisible();
    await expect(systemConsolePage.mobileSecurity.authProvider.dropdown).toBeDisabled();
});

test('should disable Intune inputs when toggle is off', async ({pw}) => {
    const {adminUser, adminClient} = await pw.initSetup();

    const license = await adminClient.getClientLicenseOld();

    test.skip(license.SkuShortName !== 'advanced', 'Skipping test - server does not have enterprise advanced license');

    if (!adminUser) {
        throw new Error('Failed to create admin user');
    }

    // # Configure Office365 settings
    const config = await adminClient.getConfig();
    config.Office365Settings.Enable = true;
    config.Office365Settings.Id = 'test-client-id';
    config.Office365Settings.Secret = 'test-secret';
    config.Office365Settings.DirectoryId = 'test-directory-id';
    await adminClient.updateConfig(config);

    // # Log in as admin
    const {systemConsolePage} = await pw.testBrowser.login(adminUser);

    // # Visit system console
    await systemConsolePage.goto();
    await systemConsolePage.toBeVisible();

    // # Go to Mobile Security section
    await systemConsolePage.sidebar.mobileSecurity.click();

    // * Verify Intune inputs are disabled when toggle is off
    expect(await systemConsolePage.mobileSecurity.authProvider.dropdown.isDisabled()).toBe(true);
    expect(await systemConsolePage.mobileSecurity.tenantId.input.isDisabled()).toBe(true);
    expect(await systemConsolePage.mobileSecurity.clientId.input.isDisabled()).toBe(true);

    // # Enable Intune
    await systemConsolePage.mobileSecurity.enableIntuneMAM.selectTrue();

    // * Verify Intune inputs are now enabled
    expect(await systemConsolePage.mobileSecurity.authProvider.dropdown.isDisabled()).toBe(false);
    expect(await systemConsolePage.mobileSecurity.tenantId.input.isDisabled()).toBe(false);
    expect(await systemConsolePage.mobileSecurity.clientId.input.isDisabled()).toBe(false);
});
