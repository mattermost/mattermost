// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

test('should be able to enable mobile security settings when licensed', async ({pw}) => {
    const {adminUser, adminClient} = await pw.initSetup();

    const license = await adminClient.getClientLicenseOld();

    test.skip(license.SkuShortName !== 'enterprise', 'Skipping test - server has no enterprise license');

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
});

test('should show mobile security upsell when not licensed', async ({pw}) => {
    const {adminUser, adminClient} = await pw.initSetup();

    const license = await adminClient.getClientLicenseOld();

    test.skip(license.SkuShortName === 'enterprise', 'Skipping test - server has enterprise license');

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
