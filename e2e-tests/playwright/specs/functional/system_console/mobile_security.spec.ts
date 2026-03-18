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
    await pw.waitUntil(async () => (await systemConsolePage.mobileSecurity.saveButton.textContent()) === 'Save');

    // # Go to any other section and come back to Mobile Security
    await systemConsolePage.sidebar.users.click();
    await systemConsolePage.users.toBeVisible();

    await systemConsolePage.sidebar.mobileSecurity.click();
    await systemConsolePage.mobileSecurity.toBeVisible();

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
    await pw.waitUntil(async () => (await systemConsolePage.mobileSecurity.saveButton.textContent()) === 'Save');

    // # Go to any other section and come back to Mobile Security
    await systemConsolePage.sidebar.users.click();
    await systemConsolePage.users.toBeVisible();

    await systemConsolePage.sidebar.mobileSecurity.click();
    await systemConsolePage.mobileSecurity.toBeVisible();

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
    await pw.waitUntil(async () => (await systemConsolePage.mobileSecurity.saveButton.textContent()) === 'Save');

    // # Go to any other section and come back to Mobile Security
    await systemConsolePage.sidebar.users.click();
    await systemConsolePage.users.toBeVisible();

    await systemConsolePage.sidebar.mobileSecurity.click();
    await systemConsolePage.mobileSecurity.toBeVisible();

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
        await pw.waitUntil(async () => (await systemConsolePage.mobileSecurity.saveButton.textContent()) === 'Save');

        // # Go to any other section and come back to Mobile Security
        await systemConsolePage.sidebar.users.click();
        await systemConsolePage.users.toBeVisible();
        await systemConsolePage.sidebar.mobileSecurity.click();
        await systemConsolePage.mobileSecurity.toBeVisible();

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
        await pw.waitUntil(async () => (await systemConsolePage.mobileSecurity.saveButton.textContent()) === 'Save');

        // # Go to any other section and come back to Mobile Security
        await systemConsolePage.sidebar.users.click();
        await systemConsolePage.users.toBeVisible();
        await systemConsolePage.sidebar.mobileSecurity.click();
        await systemConsolePage.mobileSecurity.toBeVisible();

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
    await pw.waitUntil(async () => (await systemConsolePage.mobileSecurity.saveButton.textContent()) === 'Save');

    // # Go to any other section and come back to Mobile Security
    await systemConsolePage.sidebar.users.click();
    await systemConsolePage.users.toBeVisible();

    await systemConsolePage.sidebar.mobileSecurity.click();
    await systemConsolePage.mobileSecurity.toBeVisible();

    // * Verify Intune MAM is still enabled
    await systemConsolePage.mobileSecurity.enableIntuneMAM.toBeTrue();
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
    await systemConsolePage.sidebar.mobileSecurity.click();

    // * Verify Intune MAM toggle is visible
    await expect(systemConsolePage.mobileSecurity.enableIntuneMAM.trueOption).toBeVisible();
    await expect(systemConsolePage.mobileSecurity.enableIntuneMAM.falseOption).toBeVisible();
    await expect(systemConsolePage.mobileSecurity.authProvider.dropdown).toBeDisabled();
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
    await systemConsolePage.sidebar.mobileSecurity.click();

    // * Verify new Intune toggle is visible
    await expect(systemConsolePage.mobileSecurity.enableIntuneMAM.trueOption).toBeVisible();
    await expect(systemConsolePage.mobileSecurity.enableIntuneMAM.falseOption).toBeVisible();

    // # Enable Intune
    await systemConsolePage.mobileSecurity.enableIntuneMAM.selectTrue();

    // * Verify Intune is enabled
    await systemConsolePage.mobileSecurity.enableIntuneMAM.toBeTrue();

    // # Select Office365 as auth provider
    await systemConsolePage.mobileSecurity.authProvider.select('office365');

    // # Fill in Intune configuration
    await systemConsolePage.mobileSecurity.tenantId.fill('12345678-1234-1234-1234-123456789012');
    await systemConsolePage.mobileSecurity.clientId.fill('87654321-4321-4321-4321-210987654321');

    // # Save settings
    await systemConsolePage.mobileSecurity.save();

    // # Wait until the save button has settled
    await pw.waitUntil(async () => (await systemConsolePage.mobileSecurity.saveButton.textContent()) === 'Save');

    // # Go to any other section and come back to Mobile Security
    await systemConsolePage.sidebar.users.click();
    await systemConsolePage.users.toBeVisible();

    await systemConsolePage.sidebar.mobileSecurity.click();
    await systemConsolePage.mobileSecurity.toBeVisible();

    // * Verify Intune is still enabled and configured
    await systemConsolePage.mobileSecurity.enableIntuneMAM.toBeTrue();
    expect(await systemConsolePage.mobileSecurity.tenantId.getValue()).toBe('12345678-1234-1234-1234-123456789012');
    expect(await systemConsolePage.mobileSecurity.clientId.getValue()).toBe('87654321-4321-4321-4321-210987654321');
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
    const idpCert = `-----BEGIN CERTIFICATE-----\nMIIDXTCCAkWgAwIBAgIJAKC1r6Qw3v6OMA0GCSqGSIb3DQEBCwUAMEUxCzAJBgNVBAYTAlVTMRYwFAYDVQQIDA1Tb21lLVN0YXRlMRYwFAYDVQQKDA1FeGFtcGxlIEluYy4wHhcNMTkwMTAxMDAwMDAwWhcNMjkwMTAxMDAwMDAwWjBFMQswCQYDVQQGEwJVUzEWMBQGA1UECAwNU29tZS1TdGF0ZTEWMBQGA1UECgwNRXhhbXBsZSBJbmMuMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAu6Qw3v6OMC1r6Qw3v6OMC1r6Qw3v6OMC1r6Qw3v6OMC1r6Qw3v6OMC1r6Qw3v6OMC1r6Qw3v6OMC1r6Qw3v6OMC1r6Qw3v6OMC1r6Qw3v6OMC1r6Qw3v6OMC1r6Qw3v6OMC1r6Qw3v6OMC1r6Qw3v6OMC1r6Qw3v6OMC1r6Qw3v6OMC1r6Qw3v6OMC1r6QwIDAQABo1AwTjAdBgNVHQ4EFgQU6Qw3v6OMC1r6Qw3v6OMC1r6Qw3v6OMAwGA1UdEwQFMAMBAf8wHwYDVR0jBBgwFoAU6Qw3v6OMC1r6Qw3v6OMC1r6Qw3v6OMAwGA1UdEwQFMAMBAf8wDQYJKoZIhvcNAQELBQADggEBAKQw3v6OMC1r6Qw3v6OMC1r6Qw3v6OMC1r6Qw3v6OMC1r6Qw3v6OMC1r6Qw3v6OMC1r6Qw3v6OMC1r6Qw3v6OMC1r6Qw3v6OMC1r6Qw3v6OMC1r6Qw3v6OMC1r6Qw3v6OMC1r6Qw3v6OMC1r6Qw3v6OMC1r6Qw3v6OMC1r6Qw3v6OMC1r6Qw3v6OMC1r6Qw=\n-----END CERTIFICATE-----\n`;
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
    await systemConsolePage.sidebar.mobileSecurity.click();

    // * Verify new Intune toggle is visible
    await expect(systemConsolePage.mobileSecurity.enableIntuneMAM.trueOption).toBeVisible();

    // # Enable Intune
    await systemConsolePage.mobileSecurity.enableIntuneMAM.selectTrue();

    // # Select SAML as auth provider
    await systemConsolePage.mobileSecurity.authProvider.select('saml');

    // # Fill in Intune configuration
    await systemConsolePage.mobileSecurity.tenantId.fill('abcdef01-2345-6789-abcd-ef0123456789');
    await systemConsolePage.mobileSecurity.clientId.fill('fedcba98-7654-3210-fedc-ba9876543210');

    // # Save settings
    await systemConsolePage.mobileSecurity.save();

    // # Wait until the save button has settled
    await pw.waitUntil(async () => (await systemConsolePage.mobileSecurity.saveButton.textContent()) === 'Save');

    // # Go to any other section and come back to Mobile Security
    await systemConsolePage.sidebar.users.click();
    await systemConsolePage.users.toBeVisible();

    await systemConsolePage.sidebar.mobileSecurity.click();
    await systemConsolePage.mobileSecurity.toBeVisible();

    // * Verify Intune is still enabled and configured with SAML
    await systemConsolePage.mobileSecurity.enableIntuneMAM.toBeTrue();
    expect(await systemConsolePage.mobileSecurity.tenantId.getValue()).toBe('abcdef01-2345-6789-abcd-ef0123456789');
    expect(await systemConsolePage.mobileSecurity.clientId.getValue()).toBe('fedcba98-7654-3210-fedc-ba9876543210');
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
