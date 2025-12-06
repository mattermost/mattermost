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

    // * Verify Intune MAM toggle is visible
    await expect(systemConsolePage.mobileSecurity.enableIntuneMAMToggleTrue).toBeVisible();
    await expect(systemConsolePage.mobileSecurity.enableIntuneMAMToggleFalse).toBeVisible();

    // # Enable Intune MAM
    await systemConsolePage.mobileSecurity.clickEnableIntuneMAMToggleTrue();

    // * Verify Intune MAM is enabled
    await expect(await systemConsolePage.mobileSecurity.enableIntuneMAMToggleTrue.isChecked()).toBe(true);

    await systemConsolePage.mobileSecurity.selectIntuneAuthService('office365');

    // # Fill in Intune configuration
    await systemConsolePage.mobileSecurity.fillIntuneTenantId('12345678-1234-1234-1234-123456789012');
    await systemConsolePage.mobileSecurity.fillIntuneClientId('87654321-4321-4321-4321-210987654321');

    // # Save settings
    await systemConsolePage.mobileSecurity.clickSaveButton();

    // # Wait until the save button has settled
    await pw.waitUntil(async () => (await systemConsolePage.mobileSecurity.saveButton.textContent()) === 'Save');

    // # Go to any other section and come back to Mobile Security
    await systemConsolePage.sidebar.goToItem('Users');
    await systemConsolePage.systemUsers.toBeVisible();

    await systemConsolePage.sidebar.goToItem('Mobile Security');

    // * Verify Intune MAM is still enabled
    await expect(await systemConsolePage.mobileSecurity.enableIntuneMAMToggleTrue.isChecked()).toBe(true);
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

    // * Verify Intune MAM toggle is visible
    await expect(systemConsolePage.mobileSecurity.enableIntuneMAMToggleTrue).toBeVisible();
    await expect(systemConsolePage.mobileSecurity.enableIntuneMAMToggleFalse).toBeVisible();
    await expect(systemConsolePage.mobileSecurity.intuneAuthServiceDropdown).toBeDisabled();
});

test('should configure new IntuneSettings with Office365 auth provider', async ({pw}) => {
    const {adminUser, adminClient} = await pw.initSetup();

    const license = await adminClient.getClientLicenseOld();

    test.skip(license.SkuShortName !== 'advanced', 'Skipping test - server does not have enterprise advanced license');

    if (!adminUser) {
        throw new Error('Failed to create admin user');
    }

    // # Configure Office365 settings
    const config = await adminClient.getConfig();
    config.Office365Settings.Enable = true;
    config.Office365Settings.Id = 'test-office365-client-id';
    config.Office365Settings.Secret = 'test-office365-secret';
    config.Office365Settings.DirectoryId = 'test-office365-directory-id';
    config.SamlSettings.EmailAttribute = 'useremail';
    await adminClient.updateConfig(config);

    // # Log in as admin
    const {systemConsolePage} = await pw.testBrowser.login(adminUser);

    // # Visit system console
    await systemConsolePage.goto();
    await systemConsolePage.toBeVisible();

    // # Go to Mobile Security section
    await systemConsolePage.sidebar.goToItem('Mobile Security');

    // * Verify new Intune toggle is visible
    await expect(systemConsolePage.mobileSecurity.enableIntuneToggleTrue).toBeVisible();
    await expect(systemConsolePage.mobileSecurity.enableIntuneToggleFalse).toBeVisible();

    // # Enable Intune
    await systemConsolePage.mobileSecurity.clickEnableIntuneToggleTrue();

    // * Verify Intune is enabled
    expect(await systemConsolePage.mobileSecurity.enableIntuneToggleTrue.isChecked()).toBe(true);

    // # Select Office365 as auth provider
    await systemConsolePage.mobileSecurity.selectIntuneAuthService('office365');

    // # Fill in Intune configuration
    await systemConsolePage.mobileSecurity.fillIntuneTenantId('12345678-1234-1234-1234-123456789012');
    await systemConsolePage.mobileSecurity.fillIntuneClientId('87654321-4321-4321-4321-210987654321');

    // # Save settings
    await systemConsolePage.mobileSecurity.clickSaveButton();

    // # Wait until the save button has settled
    await pw.waitUntil(async () => (await systemConsolePage.mobileSecurity.saveButton.textContent()) === 'Save');

    // # Go to any other section and come back to Mobile Security
    await systemConsolePage.sidebar.goToItem('Users');
    await systemConsolePage.systemUsers.toBeVisible();

    await systemConsolePage.sidebar.goToItem('Mobile Security');

    // * Verify Intune is still enabled and configured
    expect(await systemConsolePage.mobileSecurity.enableIntuneToggleTrue.isChecked()).toBe(true);
    expect(await systemConsolePage.mobileSecurity.intuneTenantIdInput.inputValue()).toBe(
        '12345678-1234-1234-1234-123456789012',
    );
    expect(await systemConsolePage.mobileSecurity.intuneClientIdInput.inputValue()).toBe(
        '87654321-4321-4321-4321-210987654321',
    );
});

test('should configure new IntuneSettings with SAML auth provider', async ({pw}) => {
    // # Configure SAML settings
    const {adminUser, adminClient} = await pw.initSetup();
    const config = await adminClient.getConfig();

    const license = await adminClient.getClientLicenseOld();

    test.skip(license.SkuShortName !== 'advanced', 'Skipping test - server does not have enterprise advanced license');

    if (!adminUser) {
        throw new Error('Failed to create admin user');
    }

    // # Set server URL for fetch calls
    const serverUrl = process.env.MM_SERVER_URL || 'http://localhost:8065';

    // # Upload a valid SAML IdP certificate using fetch
    const idpCert = `-----BEGIN CERTIFICATE-----\nMIIDXTCCAkWgAwIBAgIJAKC1r6Qw3v6OMA0GCSqGSIb3DQEBCwUAMEUxCzAJBgNVBAYTAlVTMRYwFAYDVQQIDA1Tb21lLVN0YXRlMRYwFAYDVQQKDA1FeGFtcGxlIEluYy4wHhcNMTkwMTAxMDAwMDAwWhcNMjkwMTAxMDAwMDAwWjBFMQswCQYDVQQGEwJVUzEWMBQGA1UECAwNU29tZS1TdGF0ZTEWMBQGA1UECgwNRXhhbXBsZSBJbmMuMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAu6Qw3v6OMC1r6Qw3v6OMC1r6Qw3v6OMC1r6Qw3v6OMC1r6Qw3v6OMC1r6Qw3v6OMC1r6Qw3v6OMC1r6Qw3v6OMC1r6Qw3v6OMC1r6Qw3v6OMC1r6Qw3v6OMC1r6Qw3v6OMC1r6Qw3v6OMC1r6Qw3v6OMC1r6Qw3v6OMC1r6Qw3v6OMC1r6Qw3v6OMC1r6Qw3v6OMC1r6QwIDAQABo1AwTjAdBgNVHQ4EFgQU6Qw3v6OMC1r6Qw3v6OMC1r6Qw3v6OMAwGA1UdEwQFMAMBAf8wHwYDVR0jBBgwFoAU6Qw3v6OMC1r6Qw3v6OMC1r6Qw3v6OMAwGA1UdEwQFMAMBAf8wDQYJKoZIhvcNAQELBQADggEBAKQw3v6OMC1r6Qw3v6OMC1r6Qw3v6OMC1r6Qw3v6OMC1r6Qw3v6OMC1r6Qw3v6OMC1r6Qw3v6OMC1r6Qw3v6OMC1r6Qw3v6OMC1r6Qw3v6OMC1r6Qw3v6OMC1r6Qw3v6OMC1r6Qw3v6OMC1r6Qw3v6OMC1r6Qw3v6OMC1r6Qw3v6OMC1r6Qw3v6OMC1r6Qw3v6OMC1r6Qw=\n-----END CERTIFICATE-----\n`;
    const idpFormData = new FormData();
    idpFormData.append(
        'certificate',
        new Blob([idpCert], {type: 'application/x-x509-ca-cert'}),
        'Intune SAML Test.cer',
    );
    await fetch(`${serverUrl}/api/v4/saml/certificate/idp`, {
        method: 'POST',
        body: idpFormData,
        credentials: 'include',
    });

    // # Upload a minimal, valid SP public certificate (PEM-encoded)
    const spCert = `-----BEGIN CERTIFICATE-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEArv1Qw4v7OMC2r7Qw4v7OMC2r7Qw4v7OMC2r7QwIDAQAB\n-----END CERTIFICATE-----\n`;
    const spFormData = new FormData();
    spFormData.append('certificate', new Blob([spCert], {type: 'application/x-x509-ca-cert'}), 'saml-public-cert.pem');
    await fetch(`${serverUrl}/api/v4/saml/certificate/public`, {
        method: 'POST',
        body: spFormData,
        credentials: 'include',
    });

    // # Configure SAML settings
    config.SamlSettings.Enable = true;
    config.SamlSettings.IdpURL = 'https://example.com/saml';
    config.SamlSettings.IdpDescriptorURL = 'https://example.com/saml/metadata';
    config.SamlSettings.IdpCertificateFile = 'test-cert.pem';
    config.SamlSettings.EmailAttribute = 'useremail';
    config.SamlSettings.UsernameAttribute = 'username';
    config.SamlSettings.ServiceProviderIdentifier = 'sp-entity-id';
    config.SamlSettings.AssertionConsumerServiceURL = 'https://sp.example.com/login';
    config.SamlSettings.IdpCertificateFile = 'saml-idp.crt';
    config.SamlSettings.PrivateKeyFile = 'saml-idp.crt';

    if ('PublicCertificateFile' in config.SamlSettings) {
        config.SamlSettings.PublicCertificateFile = 'saml-public-cert.pem';
    }
    await adminClient.updateConfig(config);

    // # Log in as admin
    const {systemConsolePage} = await pw.testBrowser.login(adminUser);

    // # Visit system console
    await systemConsolePage.goto();
    await systemConsolePage.toBeVisible();

    // # Go to Mobile Security section
    await systemConsolePage.sidebar.goToItem('Mobile Security');

    // * Verify new Intune toggle is visible
    await expect(systemConsolePage.mobileSecurity.enableIntuneToggleTrue).toBeVisible();

    // # Enable Intune
    await systemConsolePage.mobileSecurity.clickEnableIntuneToggleTrue();

    // # Select SAML as auth provider
    await systemConsolePage.mobileSecurity.selectIntuneAuthService('saml');

    // # Fill in Intune configuration
    await systemConsolePage.mobileSecurity.fillIntuneTenantId('abcdef01-2345-6789-abcd-ef0123456789');
    await systemConsolePage.mobileSecurity.fillIntuneClientId('fedcba98-7654-3210-fedc-ba9876543210');

    // # Save settings
    await systemConsolePage.mobileSecurity.clickSaveButton();

    // # Wait until the save button has settled
    await pw.waitUntil(async () => (await systemConsolePage.mobileSecurity.saveButton.textContent()) === 'Save');

    // # Go to any other section and come back to Mobile Security
    await systemConsolePage.sidebar.goToItem('Users');
    await systemConsolePage.systemUsers.toBeVisible();

    await systemConsolePage.sidebar.goToItem('Mobile Security');

    // * Verify Intune is still enabled and configured with SAML
    expect(await systemConsolePage.mobileSecurity.enableIntuneToggleTrue.isChecked()).toBe(true);
    expect(await systemConsolePage.mobileSecurity.intuneTenantIdInput.inputValue()).toBe(
        'abcdef01-2345-6789-abcd-ef0123456789',
    );
    expect(await systemConsolePage.mobileSecurity.intuneClientIdInput.inputValue()).toBe(
        'fedcba98-7654-3210-fedc-ba9876543210',
    );
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
    await systemConsolePage.sidebar.goToItem('Mobile Security');

    // * Verify Intune inputs are disabled when toggle is off
    expect(await systemConsolePage.mobileSecurity.intuneAuthServiceDropdown.isDisabled()).toBe(true);
    expect(await systemConsolePage.mobileSecurity.intuneTenantIdInput.isDisabled()).toBe(true);
    expect(await systemConsolePage.mobileSecurity.intuneClientIdInput.isDisabled()).toBe(true);

    // # Enable Intune
    await systemConsolePage.mobileSecurity.clickEnableIntuneToggleTrue();

    // * Verify Intune inputs are now enabled
    expect(await systemConsolePage.mobileSecurity.intuneAuthServiceDropdown.isDisabled()).toBe(false);
    expect(await systemConsolePage.mobileSecurity.intuneTenantIdInput.isDisabled()).toBe(false);
    expect(await systemConsolePage.mobileSecurity.intuneClientIdInput.isDisabled()).toBe(false);
});
