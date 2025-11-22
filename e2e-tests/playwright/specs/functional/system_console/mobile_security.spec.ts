// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

test('should be able to enable mobile security settings when licensed', async ({pw}) => {
    const {adminUser, adminClient} = await pw.initSetup();

    const license = await adminClient.getClientLicenseOld();

    test.skip(
        license.SkuShortName !== 'enterprise' || license.short_sku_name !== 'advanced',
        'Skipping test - server has no enterprise or enterprise advanced license',
    );

    if (!adminUser) {
        throw new Error('Failed to create admin user');
    }

    // # Log in as admin
    const {systemConsolePage} = await pw.testBrowser.login(adminUser);

    // # Visit system console
    await systemConsolePage.goto();
    await systemConsolePage.toBeVisible();

    // # Go to Mobile Security section
    await systemConsolePage.sidebar.goToItem('Mobile Security');
    await systemConsolePage.mobileSecurity.toBeVisible();

    // # Enable Biometric Authentication
    await systemConsolePage.mobileSecurity.clickEnableBiometricAuthenticationToggleTrue();

    // * Verify only Biometric Authentication is enabled
    expect(await systemConsolePage.mobileSecurity.enableBiometricAuthenticationToggleTrue.isChecked()).toBe(true);
    expect(await systemConsolePage.mobileSecurity.preventScreenCaptureToggleTrue.isChecked()).toBe(false);
    expect(await systemConsolePage.mobileSecurity.jailbreakProtectionToggleTrue.isChecked()).toBe(false);

    // # Save settings
    await systemConsolePage.mobileSecurity.clickSaveButton();
    // # Wait until the save button has settled
    await pw.waitUntil(async () => (await systemConsolePage.mobileSecurity.saveButton.textContent()) === 'Save');

    // # Go to any other section and come back to Mobile Security
    await systemConsolePage.sidebar.goToItem('Users');
    await systemConsolePage.systemUsers.toBeVisible();

    await systemConsolePage.sidebar.goToItem('Mobile Security');

    // * Verify Biometric Authentication is still enabled
    expect(await systemConsolePage.mobileSecurity.enableBiometricAuthenticationToggleTrue.isChecked()).toBe(true);
    expect(await systemConsolePage.mobileSecurity.preventScreenCaptureToggleTrue.isChecked()).toBe(false);
    expect(await systemConsolePage.mobileSecurity.jailbreakProtectionToggleTrue.isChecked()).toBe(false);

    // # Enable Prevent Screen Capture
    await systemConsolePage.mobileSecurity.clickPreventScreenCaptureToggleTrue();

    // * Verify only Biometric Authentication and Prevent Screen Capture are enabled
    expect(await systemConsolePage.mobileSecurity.enableBiometricAuthenticationToggleTrue.isChecked()).toBe(true);
    expect(await systemConsolePage.mobileSecurity.preventScreenCaptureToggleTrue.isChecked()).toBe(true);
    expect(await systemConsolePage.mobileSecurity.jailbreakProtectionToggleTrue.isChecked()).toBe(false);

    // # Save settings
    await systemConsolePage.mobileSecurity.clickSaveButton();
    // # Wait until the save button has settled
    await pw.waitUntil(async () => (await systemConsolePage.mobileSecurity.saveButton.textContent()) === 'Save');

    // # Go to any other section and come back to Mobile Security
    await systemConsolePage.sidebar.goToItem('Users');
    await systemConsolePage.systemUsers.toBeVisible();

    await systemConsolePage.sidebar.goToItem('Mobile Security');

    // * Verify Biometric Authentication and Prevent Screen Capture are still enabled
    expect(await systemConsolePage.mobileSecurity.enableBiometricAuthenticationToggleTrue.isChecked()).toBe(true);
    expect(await systemConsolePage.mobileSecurity.preventScreenCaptureToggleTrue.isChecked()).toBe(true);
    expect(await systemConsolePage.mobileSecurity.jailbreakProtectionToggleTrue.isChecked()).toBe(false);

    // # Enable Jailbreak Protection
    await systemConsolePage.mobileSecurity.clickJailbreakProtectionToggleTrue();

    // * Verify all toggles are enabled
    expect(await systemConsolePage.mobileSecurity.enableBiometricAuthenticationToggleTrue.isChecked()).toBe(true);
    expect(await systemConsolePage.mobileSecurity.preventScreenCaptureToggleTrue.isChecked()).toBe(true);
    expect(await systemConsolePage.mobileSecurity.jailbreakProtectionToggleTrue.isChecked()).toBe(true);

    // # Save settings
    await systemConsolePage.mobileSecurity.clickSaveButton();
    // # Wait until the save button has settled
    await pw.waitUntil(async () => (await systemConsolePage.mobileSecurity.saveButton.textContent()) === 'Save');

    // # Go to any other section and come back to Mobile Security
    await systemConsolePage.sidebar.goToItem('Users');
    await systemConsolePage.systemUsers.toBeVisible();

    await systemConsolePage.sidebar.goToItem('Mobile Security');

    // * Verify all toggles are still enabled
    expect(await systemConsolePage.mobileSecurity.enableBiometricAuthenticationToggleTrue.isChecked()).toBe(true);
    expect(await systemConsolePage.mobileSecurity.preventScreenCaptureToggleTrue.isChecked()).toBe(true);
    expect(await systemConsolePage.mobileSecurity.jailbreakProtectionToggleTrue.isChecked()).toBe(true);

    if (license.SkuShortName === 'advanced') {
        // # Enable Secure File Preview
        await systemConsolePage.mobileSecurity.clickEnableSecureFilePreviewToggleTrue();

        // * Verify all toggles are enabled
        expect(await systemConsolePage.mobileSecurity.enableBiometricAuthenticationToggleTrue.isChecked()).toBe(true);
        expect(await systemConsolePage.mobileSecurity.preventScreenCaptureToggleTrue.isChecked()).toBe(true);
        expect(await systemConsolePage.mobileSecurity.jailbreakProtectionToggleTrue.isChecked()).toBe(true);
        expect(await systemConsolePage.mobileSecurity.enableSecureFilePreviewToggleTrue.isChecked()).toBe(true);
        expect(await systemConsolePage.mobileSecurity.allowPdfLinkNavigationToggleTrue.isChecked()).toBe(false);

        // # Save settings
        await systemConsolePage.mobileSecurity.clickSaveButton();
        // # Wait until the save button has settled
        await pw.waitUntil(async () => (await systemConsolePage.mobileSecurity.saveButton.textContent()) === 'Save');

        // # Go to any other section and come back to Mobile Security
        await systemConsolePage.sidebar.goToItem('Users');
        await systemConsolePage.systemUsers.toBeVisible();
        await systemConsolePage.sidebar.goToItem('Mobile Security');

        // * Verify all toggles are still enabled
        expect(await systemConsolePage.mobileSecurity.enableBiometricAuthenticationToggleTrue.isChecked()).toBe(true);
        expect(await systemConsolePage.mobileSecurity.preventScreenCaptureToggleTrue.isChecked()).toBe(true);
        expect(await systemConsolePage.mobileSecurity.jailbreakProtectionToggleTrue.isChecked()).toBe(true);
        expect(await systemConsolePage.mobileSecurity.enableSecureFilePreviewToggleTrue.isChecked()).toBe(true);
        expect(await systemConsolePage.mobileSecurity.allowPdfLinkNavigationToggleTrue.isChecked()).toBe(false);

        // # Enable Allow PDF Link Navigation
        await systemConsolePage.mobileSecurity.clickAllowPdfLinkNavigationToggleTrue();

        // * Verify all toggles are enabled
        expect(await systemConsolePage.mobileSecurity.enableBiometricAuthenticationToggleTrue.isChecked()).toBe(true);
        expect(await systemConsolePage.mobileSecurity.preventScreenCaptureToggleTrue.isChecked()).toBe(true);
        expect(await systemConsolePage.mobileSecurity.jailbreakProtectionToggleTrue.isChecked()).toBe(true);
        expect(await systemConsolePage.mobileSecurity.enableSecureFilePreviewToggleTrue.isChecked()).toBe(true);
        expect(await systemConsolePage.mobileSecurity.allowPdfLinkNavigationToggleTrue.isChecked()).toBe(true);

        // # Save settings
        await systemConsolePage.mobileSecurity.clickSaveButton();
        // # Wait until the save button has settled
        await pw.waitUntil(async () => (await systemConsolePage.mobileSecurity.saveButton.textContent()) === 'Save');

        // # Go to any other section and come back to Mobile Security
        await systemConsolePage.sidebar.goToItem('Users');
        await systemConsolePage.systemUsers.toBeVisible();
        await systemConsolePage.sidebar.goToItem('Mobile Security');

        // * Verify all toggles are still enabled
        expect(await systemConsolePage.mobileSecurity.enableBiometricAuthenticationToggleTrue.isChecked()).toBe(true);
        expect(await systemConsolePage.mobileSecurity.preventScreenCaptureToggleTrue.isChecked()).toBe(true);
        expect(await systemConsolePage.mobileSecurity.jailbreakProtectionToggleTrue.isChecked()).toBe(true);
        expect(await systemConsolePage.mobileSecurity.enableSecureFilePreviewToggleTrue.isChecked()).toBe(true);
        expect(await systemConsolePage.mobileSecurity.allowPdfLinkNavigationToggleTrue.isChecked()).toBe(true);
    }
});

test('should show mobile security upsell when not licensed', async ({pw}) => {
    const {adminUser, adminClient} = await pw.initSetup();

    const license = await adminClient.getClientLicenseOld();

    test.skip(
        license.SkuShortName !== 'enterprise' || license.short_sku_name !== 'advanced',
        'Skipping test - server has no enterprise or enterprise advanced license',
    );

    if (!adminUser) {
        throw new Error('Failed to create admin user');
    }

    // # Log in as admin
    const {systemConsolePage} = await pw.testBrowser.login(adminUser);

    // # Visit system console
    await systemConsolePage.goto();
    await systemConsolePage.toBeVisible();

    // # Go to Mobile Security section
    await systemConsolePage.sidebar.goToItem('Mobile Security');
    await systemConsolePage.featureDiscovery.toBeVisible();

    // * Verify title is correct
    await systemConsolePage.featureDiscovery.toHaveTitle('Enhance mobile app security with Mattermost Enterprise');
});

test('should show and enable Intune MAM when Enterprise Advanced licensed and Office365 configured', async ({pw}) => {
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
    config.Office365Settings.Secret = 'test-client-secret';
    config.Office365Settings.DirectoryId = 'test-directory-id';
    await adminClient.updateConfig(config);

    // # Log in as admin
    const {systemConsolePage} = await pw.testBrowser.login(adminUser);

    // # Visit system console
    await systemConsolePage.goto();
    await systemConsolePage.toBeVisible();

    // # Go to Mobile Security section
    await systemConsolePage.sidebar.goToItem('Mobile Security');
    await systemConsolePage.mobileSecurity.toBeVisible();

    // * Verify Intune MAM toggle is visible
    await expect(systemConsolePage.mobileSecurity.enableIntuneMAMToggleTrue).toBeVisible();
    await expect(systemConsolePage.mobileSecurity.enableIntuneMAMToggleFalse).toBeVisible();

    // # Enable Intune MAM
    await systemConsolePage.mobileSecurity.clickEnableIntuneMAMToggleTrue();

    // * Verify Intune MAM is enabled
    expect(await systemConsolePage.mobileSecurity.enableIntuneMAMToggleTrue.isChecked()).toBe(true);

    // # Save settings
    await systemConsolePage.mobileSecurity.clickSaveButton();
    // # Wait until the save button has settled
    await pw.waitUntil(async () => (await systemConsolePage.mobileSecurity.saveButton.textContent()) === 'Save');

    // # Go to any other section and come back to Mobile Security
    await systemConsolePage.sidebar.goToItem('Users');
    await systemConsolePage.systemUsers.toBeVisible();

    await systemConsolePage.sidebar.goToItem('Mobile Security');

    // * Verify Intune MAM is still enabled
    expect(await systemConsolePage.mobileSecurity.enableIntuneMAMToggleTrue.isChecked()).toBe(true);

    // # Disable Intune MAM
    await systemConsolePage.mobileSecurity.clickEnableIntuneMAMToggleFalse();

    // * Verify Intune MAM is disabled
    expect(await systemConsolePage.mobileSecurity.enableIntuneMAMToggleFalse.isChecked()).toBe(true);

    // # Save settings
    await systemConsolePage.mobileSecurity.clickSaveButton();
    // # Wait until the save button has settled
    await pw.waitUntil(async () => (await systemConsolePage.mobileSecurity.saveButton.textContent()) === 'Save');
});

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
    await systemConsolePage.sidebar.goToItem('Mobile Security');
    await systemConsolePage.mobileSecurity.toBeVisible();

    // * Verify Intune MAM toggle is NOT visible
    await expect(systemConsolePage.mobileSecurity.enableIntuneMAMToggleTrue).not.toBeVisible();
    await expect(systemConsolePage.mobileSecurity.enableIntuneMAMToggleFalse).not.toBeVisible();
});
