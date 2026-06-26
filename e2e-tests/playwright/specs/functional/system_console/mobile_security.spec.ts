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
    await adminClient.patchConfig({
        Office365Settings: {
            Enable: true,
            Id: 'test-client-id',
            Secret: 'test-client-secret',
            DirectoryId: 'test-directory-id',
        },
    } as any);

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
    await adminClient.patchConfig({
        Office365Settings: {
            Enable: false,
        },
    } as any);

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
    await adminClient.patchConfig({
        Office365Settings: {
            Enable: true,
            Id: 'test-office365-client-id',
            Secret: 'test-office365-secret',
            DirectoryId: 'test-office365-directory-id',
        },
        SamlSettings: {
            EmailAttribute: 'useremail',
        },
    } as any);
    await pw.waitUntil(async () => {
        const cfg = await adminClient.getConfig();
        return cfg.Office365Settings?.Enable === true && Boolean(cfg.Office365Settings?.Id);
    });

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

    // # Select Office365 as auth provider.
    // After enabling Intune MAM the form re-renders; scroll the dropdown into view
    // before selecting so it is both visible and interactive.
    await systemConsolePage.mobileSecurity.authProvider.dropdown.scrollIntoViewIfNeeded();
    await expect(systemConsolePage.mobileSecurity.authProvider.dropdown).toBeEnabled({timeout: 15000});
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
    const license = await adminClient.getClientLicenseOld();

    test.skip(license.SkuShortName !== 'advanced', 'Skipping test - server does not have enterprise advanced license');

    if (!adminUser) {
        throw new Error('Failed to create admin user');
    }

    // # Set server URL for fetch calls
    const serverUrl = process.env.MM_SERVER_URL || 'http://localhost:8065';

    // # Upload a valid SAML IdP certificate using fetch
    const idpCert =
        '-----BEGIN CERTIFICATE-----\nMIIDXTCCAkWgAwIBAgIJAKC1r6Qw3v6OMA0GCSqGSIb3DQEBCwUAMEUxCzAJBgNVBAYTAlVTMRYwFAYDVQQIDA1Tb21lLVN0YXRlMRYwFAYDVQQKDA1FeGFtcGxlIEluYy4wHhcNMTkwMTAxMDAwMDAwWhcNMjkwMTAxMDAwMDAwWjBFMQswCQYDVQQGEwJVUzEWMBQGA1UECAwNU29tZS1TdGF0ZTEWMBQGA1UECgwNRXhhbXBsZSBJbmMuMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAu6Qw3v6OMC1r6Qw3v6OMC1r6Qw3v6OMC1r6Qw3v6OMC1r6Qw3v6OMC1r6Qw3v6OMC1r6Qw3v6OMC1r6Qw3v6OMC1r6Qw3v6OMC1r6Qw3v6OMC1r6Qw3v6OMC1r6Qw3v6OMC1r6Qw3v6OMC1r6Qw3v6OMC1r6Qw3v6OMC1r6Qw3v6OMC1r6Qw3v6OMC1r6QwIDAQABo1AwTjAdBgNVHQ4EFgQU6Qw3v6OMC1r6Qw3v6OMC1r6Qw3v6OMAwGA1UdEwQFMAMBAf8wHwYDVR0jBBgwFoAU6Qw3v6OMC1r6Qw3v6OMC1r6Qw3v6OMAwGA1UdEwQFMAMBAf8wDQYJKoZIhvcNAQELBQADggEBAKQw3v6OMC1r6Qw3v6OMC1r6Qw3v6OMC1r6Qw3v6OMC1r6Qw3v6OMC1r6Qw3v6OMC1r6Qw3v6OMC1r6Qw3v6OMC1r6Qw3v6OMC1r6Qw3v6OMC1r6Qw3v6OMC1r6Qw3v6OMC1r6Qw3v6OMC1r6Qw3v6OMC1r6Qw3v6OMC1r6Qw3v6OMC1r6Qw3v6OMC1r6Qw=\n-----END CERTIFICATE-----\n';
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
    const spCert =
        '-----BEGIN CERTIFICATE-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEArv1Qw4v7OMC2r7Qw4v7OMC2r7Qw4v7OMC2r7QwIDAQAB\n-----END CERTIFICATE-----\n';
    const spFormData = new FormData();
    spFormData.append('certificate', new Blob([spCert], {type: 'application/x-x509-ca-cert'}), 'saml-public-cert.pem');
    await fetch(`${serverUrl}/api/v4/saml/certificate/public`, {
        method: 'POST',
        body: spFormData,
        credentials: 'include',
    });

    // # Configure SAML settings
    await adminClient.patchConfig({
        SamlSettings: {
            Enable: true,
            IdpURL: 'https://example.com/saml',
            IdpDescriptorURL: 'https://example.com/saml/metadata',
            IdpCertificateFile: 'saml-idp.crt',
            EmailAttribute: 'useremail',
            UsernameAttribute: 'username',
            ServiceProviderIdentifier: 'sp-entity-id',
            AssertionConsumerServiceURL: 'https://sp.example.com/login',
            PrivateKeyFile: 'saml-idp.crt',
            PublicCertificateFile: 'saml-public-cert.pem',
        },
    } as any);

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
    await adminClient.patchConfig({
        Office365Settings: {
            Enable: true,
            Id: 'test-client-id',
            Secret: 'test-secret',
            DirectoryId: 'test-directory-id',
        },
    } as any);

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

/**
 * @objective Verify timer settings are disabled when Mobile Ephemeral Mode is not enabled, and become editable when enabled
 */
test(
    'should disable Mobile Ephemeral Mode sub-settings when toggle is off and enable them when toggle is on',
    {tag: '@mobile_ephemeral_mode'},
    async ({pw}) => {
        const {adminUser, adminClient} = await pw.initSetup();

        const license = await adminClient.getClientLicenseOld();

        test.skip(
            license.SkuShortName !== 'advanced',
            'Skipping test - server does not have enterprise advanced license',
        );

        const config = await adminClient.getConfig();
        test.skip(
            config.FeatureFlags.MobileEphemeralMode !== true && config.FeatureFlags.MobileEphemeralMode !== 'true',
            'Skipping test - MobileEphemeralMode feature flag is not enabled on the server',
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

        // * Verify Mobile Ephemeral Mode toggle is off by default
        await systemConsolePage.mobileSecurity.enableMobileEphemeralMode.toBeFalse();

        // * Verify all sub-settings are disabled
        expect(await systemConsolePage.mobileSecurity.disconnectionTimeout.input.isDisabled()).toBe(true);
        expect(await systemConsolePage.mobileSecurity.offlinePersistenceTimer.input.isDisabled()).toBe(true);
        expect(await systemConsolePage.mobileSecurity.autoCacheCleanup.input.isDisabled()).toBe(true);

        // # Enable Mobile Ephemeral Mode toggle
        await systemConsolePage.mobileSecurity.enableMobileEphemeralMode.selectTrue();

        // * Verify all sub-settings are now enabled
        expect(await systemConsolePage.mobileSecurity.disconnectionTimeout.input.isDisabled()).toBe(false);
        expect(await systemConsolePage.mobileSecurity.offlinePersistenceTimer.input.isDisabled()).toBe(false);
        expect(await systemConsolePage.mobileSecurity.autoCacheCleanup.input.isDisabled()).toBe(false);
    },
);

/**
 * @objective Verify all Mobile Ephemeral Mode settings persist after save and navigation
 */
test(
    'should save and persist all Mobile Ephemeral Mode settings after navigation',
    {tag: '@mobile_ephemeral_mode'},
    async ({pw}) => {
        const {adminUser, adminClient} = await pw.initSetup();

        const license = await adminClient.getClientLicenseOld();

        test.skip(
            license.SkuShortName !== 'advanced',
            'Skipping test - server does not have enterprise advanced license',
        );

        const config = await adminClient.getConfig();
        test.skip(
            config.FeatureFlags.MobileEphemeralMode !== true && config.FeatureFlags.MobileEphemeralMode !== 'true',
            'Skipping test - MobileEphemeralMode feature flag is not enabled on the server',
        );

        if (!adminUser) {
            throw new Error('Failed to create admin user');
        }

        // # Enable Mobile Ephemeral Mode setting via config API
        config.MobileEphemeralModeSettings.Enable = true;
        await adminClient.updateConfig(config);

        // # Log in as admin
        const {systemConsolePage} = await pw.testBrowser.login(adminUser);

        // # Visit system console
        await systemConsolePage.goto();
        await systemConsolePage.toBeVisible();

        // # Go to Mobile Security section
        await systemConsolePage.sidebar.mobileSecurity.click();
        await systemConsolePage.mobileSecurity.toBeVisible();

        // # Set custom values
        await systemConsolePage.mobileSecurity.disconnectionTimeout.fill('120');
        await systemConsolePage.mobileSecurity.offlinePersistenceTimer.fill('48');
        await systemConsolePage.mobileSecurity.autoCacheCleanup.fill('14');

        // # Save settings
        await systemConsolePage.mobileSecurity.save();
        await pw.waitUntil(async () => (await systemConsolePage.mobileSecurity.saveButton.textContent()) === 'Save');

        // # Navigate away and back
        await systemConsolePage.sidebar.users.click();
        await systemConsolePage.users.toBeVisible();
        await systemConsolePage.sidebar.mobileSecurity.click();
        await systemConsolePage.mobileSecurity.toBeVisible();

        // * Verify Mobile Ephemeral Mode is still enabled
        await systemConsolePage.mobileSecurity.enableMobileEphemeralMode.toBeTrue();

        // * Verify all values persisted correctly
        expect(await systemConsolePage.mobileSecurity.disconnectionTimeout.getValue()).toBe('120');
        expect(await systemConsolePage.mobileSecurity.offlinePersistenceTimer.getValue()).toBe('48');
        expect(await systemConsolePage.mobileSecurity.autoCacheCleanup.getValue()).toBe('14');
    },
);

/**
 * @objective Verify offline persistence timer is disabled when auto cache cleanup is set to 0 (zero-persistence mode)
 */
test(
    'should disable offline persistence timer when auto cache cleanup is set to zero',
    {tag: '@mobile_ephemeral_mode'},
    async ({pw}) => {
        const {adminUser, adminClient} = await pw.initSetup();

        const license = await adminClient.getClientLicenseOld();

        test.skip(
            license.SkuShortName !== 'advanced',
            'Skipping test - server does not have enterprise advanced license',
        );

        const config = await adminClient.getConfig();
        test.skip(
            config.FeatureFlags.MobileEphemeralMode !== true && config.FeatureFlags.MobileEphemeralMode !== 'true',
            'Skipping test - MobileEphemeralMode feature flag is not enabled on the server',
        );

        if (!adminUser) {
            throw new Error('Failed to create admin user');
        }

        // # Enable Mobile Ephemeral Mode setting via config API
        config.MobileEphemeralModeSettings.Enable = true;
        await adminClient.updateConfig(config);

        // # Log in as admin
        const {systemConsolePage} = await pw.testBrowser.login(adminUser);

        // # Visit system console
        await systemConsolePage.goto();
        await systemConsolePage.toBeVisible();

        // # Go to Mobile Security section
        await systemConsolePage.sidebar.mobileSecurity.click();
        await systemConsolePage.mobileSecurity.toBeVisible();

        // * Verify offline persistence timer is enabled
        expect(await systemConsolePage.mobileSecurity.offlinePersistenceTimer.input.isDisabled()).toBe(false);

        // # Set auto cache cleanup to 0
        await systemConsolePage.mobileSecurity.autoCacheCleanup.clear();
        await systemConsolePage.mobileSecurity.autoCacheCleanup.fill('0');

        // * Verify offline persistence timer is now disabled
        expect(await systemConsolePage.mobileSecurity.offlinePersistenceTimer.input.isDisabled()).toBe(true);

        // # Set auto cache cleanup back to 7
        await systemConsolePage.mobileSecurity.autoCacheCleanup.clear();
        await systemConsolePage.mobileSecurity.autoCacheCleanup.fill('7');

        // * Verify offline persistence timer is enabled again
        expect(await systemConsolePage.mobileSecurity.offlinePersistenceTimer.input.isDisabled()).toBe(false);
    },
);

/**
 * @objective Verify Mobile Ephemeral Mode settings show correct defaults on first enable
 */
test(
    'should show correct default values when Mobile Ephemeral Mode is first enabled',
    {tag: '@mobile_ephemeral_mode'},
    async ({pw}) => {
        const {adminUser, adminClient} = await pw.initSetup();

        const license = await adminClient.getClientLicenseOld();

        test.skip(
            license.SkuShortName !== 'advanced',
            'Skipping test - server does not have enterprise advanced license',
        );

        const config = await adminClient.getConfig();
        test.skip(
            config.FeatureFlags.MobileEphemeralMode !== true && config.FeatureFlags.MobileEphemeralMode !== 'true',
            'Skipping test - MobileEphemeralMode feature flag is not enabled on the server',
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

        // # Enable Mobile Ephemeral Mode
        await systemConsolePage.mobileSecurity.enableMobileEphemeralMode.selectTrue();

        // * Verify default values
        expect(await systemConsolePage.mobileSecurity.disconnectionTimeout.getValue()).toBe('60');
        expect(await systemConsolePage.mobileSecurity.offlinePersistenceTimer.getValue()).toBe('24');
        expect(await systemConsolePage.mobileSecurity.autoCacheCleanup.getValue()).toBe('7');
    },
);
