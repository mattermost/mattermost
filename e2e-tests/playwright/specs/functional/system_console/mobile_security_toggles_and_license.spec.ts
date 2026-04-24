// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

import {reloadMobileSecurityViaUsers, waitForMobileSecuritySaveSettled} from './support';

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
    await systemConsolePage.sidebar.mobileSecurity.click();
    await systemConsolePage.mobileSecurity.toBeVisible();

    // # Enable Biometric Authentication
    await systemConsolePage.mobileSecurity.enableBiometricAuthentication.selectTrue();

    // * Verify only Biometric Authentication is enabled
    await systemConsolePage.mobileSecurity.enableBiometricAuthentication.toBeTrue();
    await systemConsolePage.mobileSecurity.preventScreenCapture.toBeFalse();
    await systemConsolePage.mobileSecurity.enableJailbreakProtection.toBeFalse();

    // # Save settings
    await systemConsolePage.mobileSecurity.save();
    // # Wait until the save button has settled
    await waitForMobileSecuritySaveSettled(pw, systemConsolePage);

    // # Go to any other section and come back to Mobile Security
    await reloadMobileSecurityViaUsers(systemConsolePage);

    // * Verify Biometric Authentication is still enabled
    await systemConsolePage.mobileSecurity.enableBiometricAuthentication.toBeTrue();
    await systemConsolePage.mobileSecurity.preventScreenCapture.toBeFalse();
    await systemConsolePage.mobileSecurity.enableJailbreakProtection.toBeFalse();

    // # Enable Prevent Screen Capture
    await systemConsolePage.mobileSecurity.preventScreenCapture.selectTrue();

    // * Verify only Biometric Authentication and Prevent Screen Capture are enabled
    await systemConsolePage.mobileSecurity.enableBiometricAuthentication.toBeTrue();
    await systemConsolePage.mobileSecurity.preventScreenCapture.toBeTrue();
    await systemConsolePage.mobileSecurity.enableJailbreakProtection.toBeFalse();

    // # Save settings
    await systemConsolePage.mobileSecurity.save();
    // # Wait until the save button has settled
    await waitForMobileSecuritySaveSettled(pw, systemConsolePage);

    // # Go to any other section and come back to Mobile Security
    await reloadMobileSecurityViaUsers(systemConsolePage);

    // * Verify Biometric Authentication and Prevent Screen Capture are still enabled
    await systemConsolePage.mobileSecurity.enableBiometricAuthentication.toBeTrue();
    await systemConsolePage.mobileSecurity.preventScreenCapture.toBeTrue();
    await systemConsolePage.mobileSecurity.enableJailbreakProtection.toBeFalse();

    // # Enable Jailbreak Protection
    await systemConsolePage.mobileSecurity.enableJailbreakProtection.selectTrue();

    // * Verify all toggles are enabled
    await systemConsolePage.mobileSecurity.enableBiometricAuthentication.toBeTrue();
    await systemConsolePage.mobileSecurity.preventScreenCapture.toBeTrue();
    await systemConsolePage.mobileSecurity.enableJailbreakProtection.toBeTrue();

    // # Save settings
    await systemConsolePage.mobileSecurity.save();
    // # Wait until the save button has settled
    await waitForMobileSecuritySaveSettled(pw, systemConsolePage);

    // # Go to any other section and come back to Mobile Security
    await reloadMobileSecurityViaUsers(systemConsolePage);

    // * Verify all toggles are still enabled
    await systemConsolePage.mobileSecurity.enableBiometricAuthentication.toBeTrue();
    await systemConsolePage.mobileSecurity.preventScreenCapture.toBeTrue();
    await systemConsolePage.mobileSecurity.enableJailbreakProtection.toBeTrue();

    if (license.SkuShortName === 'advanced') {
        // # Enable Secure File Preview
        await systemConsolePage.mobileSecurity.enableSecureFilePreviewMode.selectTrue();

        // * Verify all toggles are enabled
        await systemConsolePage.mobileSecurity.enableBiometricAuthentication.toBeTrue();
        await systemConsolePage.mobileSecurity.preventScreenCapture.toBeTrue();
        await systemConsolePage.mobileSecurity.enableJailbreakProtection.toBeTrue();
        await systemConsolePage.mobileSecurity.enableSecureFilePreviewMode.toBeTrue();
        await systemConsolePage.mobileSecurity.allowPdfLinkNavigation.toBeFalse();

        // # Save settings
        await systemConsolePage.mobileSecurity.save();
        // # Wait until the save button has settled
        await waitForMobileSecuritySaveSettled(pw, systemConsolePage);

        // # Go to any other section and come back to Mobile Security
        await reloadMobileSecurityViaUsers(systemConsolePage);

        // * Verify all toggles are still enabled
        await systemConsolePage.mobileSecurity.enableBiometricAuthentication.toBeTrue();
        await systemConsolePage.mobileSecurity.preventScreenCapture.toBeTrue();
        await systemConsolePage.mobileSecurity.enableJailbreakProtection.toBeTrue();
        await systemConsolePage.mobileSecurity.enableSecureFilePreviewMode.toBeTrue();
        await systemConsolePage.mobileSecurity.allowPdfLinkNavigation.toBeFalse();

        // # Enable Allow PDF Link Navigation
        await systemConsolePage.mobileSecurity.allowPdfLinkNavigation.selectTrue();

        // * Verify all toggles are enabled
        await systemConsolePage.mobileSecurity.enableBiometricAuthentication.toBeTrue();
        await systemConsolePage.mobileSecurity.preventScreenCapture.toBeTrue();
        await systemConsolePage.mobileSecurity.enableJailbreakProtection.toBeTrue();
        await systemConsolePage.mobileSecurity.enableSecureFilePreviewMode.toBeTrue();
        await systemConsolePage.mobileSecurity.allowPdfLinkNavigation.toBeTrue();

        // # Save settings
        await systemConsolePage.mobileSecurity.save();
        // # Wait until the save button has settled
        await waitForMobileSecuritySaveSettled(pw, systemConsolePage);

        // # Go to any other section and come back to Mobile Security
        await reloadMobileSecurityViaUsers(systemConsolePage);

        // * Verify all toggles are still enabled
        await systemConsolePage.mobileSecurity.enableBiometricAuthentication.toBeTrue();
        await systemConsolePage.mobileSecurity.preventScreenCapture.toBeTrue();
        await systemConsolePage.mobileSecurity.enableJailbreakProtection.toBeTrue();
        await systemConsolePage.mobileSecurity.enableSecureFilePreviewMode.toBeTrue();
        await systemConsolePage.mobileSecurity.allowPdfLinkNavigation.toBeTrue();
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
    await systemConsolePage.sidebar.mobileSecurity.click();
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
    await systemConsolePage.sidebar.mobileSecurity.click();

    // * Verify Intune MAM toggle is visible
    await expect(systemConsolePage.mobileSecurity.enableIntuneMAM.trueOption).toBeVisible();
    await expect(systemConsolePage.mobileSecurity.enableIntuneMAM.falseOption).toBeVisible();

    // # Enable Intune MAM
    await systemConsolePage.mobileSecurity.enableIntuneMAM.selectTrue();

    // * Verify Intune MAM is enabled
    await systemConsolePage.mobileSecurity.enableIntuneMAM.toBeTrue();

    await systemConsolePage.mobileSecurity.authProvider.select('office365');

    // # Fill in Intune configuration
    await systemConsolePage.mobileSecurity.tenantId.fill('12345678-1234-1234-1234-123456789012');
    await systemConsolePage.mobileSecurity.clientId.fill('87654321-4321-4321-4321-210987654321');

    // # Save settings
    await systemConsolePage.mobileSecurity.save();

    // # Wait until the save button has settled
    await waitForMobileSecuritySaveSettled(pw, systemConsolePage);

    // # Go to any other section and come back to Mobile Security
    await reloadMobileSecurityViaUsers(systemConsolePage);

    // * Verify Intune MAM is still enabled
    await systemConsolePage.mobileSecurity.enableIntuneMAM.toBeTrue();
});
