// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Api, duration, expect, Msg, settle, test, testConfig} from '@mattermost/playwright-lib';

import {openMobileSecurity, openMobileSecurityUpsell, openUsers} from './mobile_security_support';

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
    const {app} = await pw.testBrowser.login(adminUser);

    // # Go to Mobile Security section
    await openMobileSecurity(app);

    // # Enable Biometric Authentication
    await app.admin.setting('NativeAppSettings.MobileEnableBiometrics').trueRadio.check();
    await expect(app.admin.setting('NativeAppSettings.MobileEnableBiometrics').trueRadio).toBeChecked();

    // * Verify only Biometric Authentication is enabled
    await expect(app.admin.setting('NativeAppSettings.MobileEnableBiometrics').trueRadio).toBeChecked();
    await expect(app.admin.setting('NativeAppSettings.MobilePreventScreenCapture').falseRadio).toBeChecked();
    await expect(app.admin.setting('NativeAppSettings.MobileJailbreakProtection').falseRadio).toBeChecked();

    // # Save settings
    await settle(app.admin.saveButton, {wait: Api.PatchConfig}).click();
    await expect(app.admin.saveButton).toBeSaved();

    // # Go to any other section and come back to Mobile Security
    await openUsers(app);

    await openMobileSecurity(app);

    // * Verify Biometric Authentication is still enabled
    await expect(app.admin.setting('NativeAppSettings.MobileEnableBiometrics').trueRadio).toBeChecked();
    await expect(app.admin.setting('NativeAppSettings.MobilePreventScreenCapture').falseRadio).toBeChecked();
    await expect(app.admin.setting('NativeAppSettings.MobileJailbreakProtection').falseRadio).toBeChecked();

    // # Enable Prevent Screen Capture
    await app.admin.setting('NativeAppSettings.MobilePreventScreenCapture').trueRadio.check();
    await expect(app.admin.setting('NativeAppSettings.MobilePreventScreenCapture').trueRadio).toBeChecked();

    // * Verify only Biometric Authentication and Prevent Screen Capture are enabled
    await expect(app.admin.setting('NativeAppSettings.MobileEnableBiometrics').trueRadio).toBeChecked();
    await expect(app.admin.setting('NativeAppSettings.MobilePreventScreenCapture').trueRadio).toBeChecked();
    await expect(app.admin.setting('NativeAppSettings.MobileJailbreakProtection').falseRadio).toBeChecked();

    // # Save settings
    await settle(app.admin.saveButton, {wait: Api.PatchConfig}).click();
    await expect(app.admin.saveButton).toBeSaved();

    // # Go to any other section and come back to Mobile Security
    await openUsers(app);

    await openMobileSecurity(app);

    // * Verify Biometric Authentication and Prevent Screen Capture are still enabled
    await expect(app.admin.setting('NativeAppSettings.MobileEnableBiometrics').trueRadio).toBeChecked();
    await expect(app.admin.setting('NativeAppSettings.MobilePreventScreenCapture').trueRadio).toBeChecked();
    await expect(app.admin.setting('NativeAppSettings.MobileJailbreakProtection').falseRadio).toBeChecked();

    // # Enable Jailbreak Protection
    await app.admin.setting('NativeAppSettings.MobileJailbreakProtection').trueRadio.check();
    await expect(app.admin.setting('NativeAppSettings.MobileJailbreakProtection').trueRadio).toBeChecked();

    // * Verify all toggles are enabled
    await expect(app.admin.setting('NativeAppSettings.MobileEnableBiometrics').trueRadio).toBeChecked();
    await expect(app.admin.setting('NativeAppSettings.MobilePreventScreenCapture').trueRadio).toBeChecked();
    await expect(app.admin.setting('NativeAppSettings.MobileJailbreakProtection').trueRadio).toBeChecked();

    // # Save settings
    await settle(app.admin.saveButton, {wait: Api.PatchConfig}).click();
    await expect(app.admin.saveButton).toBeSaved();

    // # Go to any other section and come back to Mobile Security
    await openUsers(app);

    await openMobileSecurity(app);

    // * Verify all toggles are still enabled
    await expect(app.admin.setting('NativeAppSettings.MobileEnableBiometrics').trueRadio).toBeChecked();
    await expect(app.admin.setting('NativeAppSettings.MobilePreventScreenCapture').trueRadio).toBeChecked();
    await expect(app.admin.setting('NativeAppSettings.MobileJailbreakProtection').trueRadio).toBeChecked();

    if (license.SkuShortName === 'advanced') {
        // # Enable Secure File Preview
        await app.admin.setting('NativeAppSettings.MobileEnableSecureFilePreview').trueRadio.check();
        await expect(app.admin.setting('NativeAppSettings.MobileEnableSecureFilePreview').trueRadio).toBeChecked();

        // * Verify all toggles are enabled
        await expect(app.admin.setting('NativeAppSettings.MobileEnableBiometrics').trueRadio).toBeChecked();
        await expect(app.admin.setting('NativeAppSettings.MobilePreventScreenCapture').trueRadio).toBeChecked();
        await expect(app.admin.setting('NativeAppSettings.MobileJailbreakProtection').trueRadio).toBeChecked();
        await expect(app.admin.setting('NativeAppSettings.MobileEnableSecureFilePreview').trueRadio).toBeChecked();
        await expect(app.admin.setting('NativeAppSettings.MobileAllowPdfLinkNavigation').falseRadio).toBeChecked();

        // # Save settings
        await settle(app.admin.saveButton, {wait: Api.PatchConfig}).click();
        await expect(app.admin.saveButton).toBeSaved();

        // # Go to any other section and come back to Mobile Security
        await openUsers(app);
        await openMobileSecurity(app);

        // * Verify all toggles are still enabled
        await expect(app.admin.setting('NativeAppSettings.MobileEnableBiometrics').trueRadio).toBeChecked();
        await expect(app.admin.setting('NativeAppSettings.MobilePreventScreenCapture').trueRadio).toBeChecked();
        await expect(app.admin.setting('NativeAppSettings.MobileJailbreakProtection').trueRadio).toBeChecked();
        await expect(app.admin.setting('NativeAppSettings.MobileEnableSecureFilePreview').trueRadio).toBeChecked();
        await expect(app.admin.setting('NativeAppSettings.MobileAllowPdfLinkNavigation').falseRadio).toBeChecked();

        // # Enable Allow PDF Link Navigation
        await app.admin.setting('NativeAppSettings.MobileAllowPdfLinkNavigation').trueRadio.check();
        await expect(app.admin.setting('NativeAppSettings.MobileAllowPdfLinkNavigation').trueRadio).toBeChecked();

        // * Verify all toggles are enabled
        await expect(app.admin.setting('NativeAppSettings.MobileEnableBiometrics').trueRadio).toBeChecked();
        await expect(app.admin.setting('NativeAppSettings.MobilePreventScreenCapture').trueRadio).toBeChecked();
        await expect(app.admin.setting('NativeAppSettings.MobileJailbreakProtection').trueRadio).toBeChecked();
        await expect(app.admin.setting('NativeAppSettings.MobileEnableSecureFilePreview').trueRadio).toBeChecked();
        await expect(app.admin.setting('NativeAppSettings.MobileAllowPdfLinkNavigation').trueRadio).toBeChecked();

        // # Save settings
        await settle(app.admin.saveButton, {wait: Api.PatchConfig}).click();
        await expect(app.admin.saveButton).toBeSaved();

        // # Go to any other section and come back to Mobile Security
        await openUsers(app);
        await openMobileSecurity(app);

        // * Verify all toggles are still enabled
        await expect(app.admin.setting('NativeAppSettings.MobileEnableBiometrics').trueRadio).toBeChecked();
        await expect(app.admin.setting('NativeAppSettings.MobilePreventScreenCapture').trueRadio).toBeChecked();
        await expect(app.admin.setting('NativeAppSettings.MobileJailbreakProtection').trueRadio).toBeChecked();
        await expect(app.admin.setting('NativeAppSettings.MobileEnableSecureFilePreview').trueRadio).toBeChecked();
        await expect(app.admin.setting('NativeAppSettings.MobileAllowPdfLinkNavigation').trueRadio).toBeChecked();
    }
});

test('should show mobile security upsell when not licensed', async ({pw}) => {
    const {adminUser, adminClient} = await pw.initSetup();

    const license = await adminClient.getClientLicenseOld();

    // the upsell shows below Enterprise
    test.skip(
        license.SkuShortName !== 'enterprise' || license.short_sku_name !== 'advanced',
        'Skipping test - server has an enterprise or enterprise advanced license, so no upsell',
    );

    if (!adminUser) {
        throw new Error('Failed to create admin user');
    }

    // # Log in as admin
    const {app} = await pw.testBrowser.login(adminUser);

    // # Go to Mobile Security section
    await openMobileSecurityUpsell(app);

    // * Verify title is correct
    await expect(app.admin.featureDiscovery.titleText).toContainMessage(
        Msg.admin.mobile_security_feature_discovery.title,
    );
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
    const {app} = await pw.testBrowser.login(adminUser);

    // # Go to Mobile Security section
    await openMobileSecurity(app);

    // * Verify Intune MAM toggle is visible
    await expect(app.admin.setting('IntuneSettings.Enable').trueRadio).toBeVisible();
    await expect(app.admin.setting('IntuneSettings.Enable').falseRadio).toBeVisible();

    // # Enable Intune MAM
    await app.admin.setting('IntuneSettings.Enable').trueRadio.check();
    await expect(app.admin.setting('IntuneSettings.Enable').trueRadio).toBeChecked();

    // * Verify Intune MAM is enabled
    await expect(app.admin.setting('IntuneSettings.Enable').trueRadio).toBeChecked();

    await app.admin.setting('IntuneSettings.AuthService').choiceCombobox.choose('OpenID Connect (Office 365)');
    await expect(app.admin.setting('IntuneSettings.AuthService').choiceCombobox).toHaveValue('office365');

    // # Fill in Intune configuration
    await app.admin.setting('IntuneSettings.TenantId').valueTextbox.fill('12345678-1234-1234-1234-123456789012');
    await app.admin.setting('IntuneSettings.ClientId').valueTextbox.fill('87654321-4321-4321-4321-210987654321');

    // # Save settings
    await settle(app.admin.saveButton, {wait: Api.PatchConfig}).click();
    await expect(app.admin.saveButton).toBeSaved();

    // # Go to any other section and come back to Mobile Security
    await openUsers(app);

    await openMobileSecurity(app);

    // * Verify Intune MAM is still enabled
    await expect(app.admin.setting('IntuneSettings.Enable').trueRadio).toBeChecked();
});

test('should hide Intune MAM when Office365 is not configured', async ({pw}) => {
    const {adminUser, adminClient} = await pw.initSetup();

    const license = await adminClient.getClientLicenseOld();

    test.skip(license.SkuShortName !== 'advanced', 'Skipping test - server does not have enterprise advanced license');

    if (!adminUser) {
        throw new Error('Failed to create admin user');
    }

    // # Disable Office365, and Intune MAM in the same patch — the server rejects a config where
    // # Intune MAM is on with AuthService 'office365' but Office365 is off
    await adminClient.patchConfig({
        IntuneSettings: {
            Enable: false,
        },
        Office365Settings: {
            Enable: false,
        },
    } as any);

    // # Log in as admin
    const {app} = await pw.testBrowser.login(adminUser);

    // # Go to Mobile Security section
    await openMobileSecurity(app);

    // * Verify Intune MAM toggle is visible
    await expect(app.admin.setting('IntuneSettings.Enable').trueRadio).toBeVisible();
    await expect(app.admin.setting('IntuneSettings.Enable').falseRadio).toBeVisible();
    await expect(app.admin.setting('IntuneSettings.AuthService').choiceCombobox).toBeDisabled();
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
    await expect
        .poll(
            async () => {
                const cfg = await adminClient.getConfig();
                return cfg.Office365Settings?.Enable === true && Boolean(cfg.Office365Settings?.Id);
            },
            {message: 'the server has the Office 365 settings'},
        )
        .toBe(true);

    // # Log in as admin
    const {app} = await pw.testBrowser.login(adminUser);

    // # Go to Mobile Security section
    await openMobileSecurity(app);

    // * Verify new Intune toggle is visible
    await expect(app.admin.setting('IntuneSettings.Enable').trueRadio).toBeVisible();
    await expect(app.admin.setting('IntuneSettings.Enable').falseRadio).toBeVisible();

    // # Enable Intune
    await app.admin.setting('IntuneSettings.Enable').trueRadio.check();
    await expect(app.admin.setting('IntuneSettings.Enable').trueRadio).toBeChecked();

    // * Verify Intune is enabled
    await expect(app.admin.setting('IntuneSettings.Enable').trueRadio).toBeChecked();

    // # Select Office365 as auth provider.
    // After enabling Intune MAM the form re-renders; scroll the dropdown into view
    // before selecting so it is both visible and interactive.
    await app.admin.setting('IntuneSettings.AuthService').choiceCombobox.scrollIntoView();
    await expect(app.admin.setting('IntuneSettings.AuthService').choiceCombobox).toBeEnabled({
        timeout: duration.half_min,
    });
    await app.admin.setting('IntuneSettings.AuthService').choiceCombobox.choose('OpenID Connect (Office 365)');
    await expect(app.admin.setting('IntuneSettings.AuthService').choiceCombobox).toHaveValue('office365');

    // # Fill in Intune configuration
    await app.admin.setting('IntuneSettings.TenantId').valueTextbox.fill('12345678-1234-1234-1234-123456789012');
    await app.admin.setting('IntuneSettings.ClientId').valueTextbox.fill('87654321-4321-4321-4321-210987654321');

    // # Save settings
    await settle(app.admin.saveButton, {wait: Api.PatchConfig}).click();
    await expect(app.admin.saveButton).toBeSaved();

    // # Go to any other section and come back to Mobile Security
    await openUsers(app);

    await openMobileSecurity(app);

    // * Verify Intune is still enabled and configured
    await expect(app.admin.setting('IntuneSettings.Enable').trueRadio).toBeChecked();
    await expect(app.admin.setting('IntuneSettings.TenantId').valueTextbox).toHaveValue(
        '12345678-1234-1234-1234-123456789012',
    );
    await expect(app.admin.setting('IntuneSettings.ClientId').valueTextbox).toHaveValue(
        '87654321-4321-4321-4321-210987654321',
    );
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
    const serverUrl = testConfig.baseURL;

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
    const {app} = await pw.testBrowser.login(adminUser);

    // # Go to Mobile Security section
    await openMobileSecurity(app);

    // * Verify new Intune toggle is visible
    await expect(app.admin.setting('IntuneSettings.Enable').trueRadio).toBeVisible();

    // # Enable Intune
    await app.admin.setting('IntuneSettings.Enable').trueRadio.check();
    await expect(app.admin.setting('IntuneSettings.Enable').trueRadio).toBeChecked();

    // # Select SAML as auth provider
    await app.admin.setting('IntuneSettings.AuthService').choiceCombobox.choose('SAML 2.0');
    await expect(app.admin.setting('IntuneSettings.AuthService').choiceCombobox).toHaveValue('saml');

    // # Fill in Intune configuration
    await app.admin.setting('IntuneSettings.TenantId').valueTextbox.fill('abcdef01-2345-6789-abcd-ef0123456789');
    await app.admin.setting('IntuneSettings.ClientId').valueTextbox.fill('fedcba98-7654-3210-fedc-ba9876543210');

    // # Save settings
    await settle(app.admin.saveButton, {wait: Api.PatchConfig}).click();
    await expect(app.admin.saveButton).toBeSaved();

    // # Go to any other section and come back to Mobile Security
    await openUsers(app);

    await openMobileSecurity(app);

    // * Verify Intune is still enabled and configured with SAML
    await expect(app.admin.setting('IntuneSettings.Enable').trueRadio).toBeChecked();
    await expect(app.admin.setting('IntuneSettings.TenantId').valueTextbox).toHaveValue(
        'abcdef01-2345-6789-abcd-ef0123456789',
    );
    await expect(app.admin.setting('IntuneSettings.ClientId').valueTextbox).toHaveValue(
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

    // # Configure Office365 settings, with the Intune MAM toggle off as this test requires
    await adminClient.patchConfig({
        IntuneSettings: {
            Enable: false,
        },
        Office365Settings: {
            Enable: true,
            Id: 'test-client-id',
            Secret: 'test-secret',
            DirectoryId: 'test-directory-id',
        },
    } as any);

    // # Log in as admin
    const {app} = await pw.testBrowser.login(adminUser);

    // # Go to Mobile Security section
    await openMobileSecurity(app);

    // * Verify Intune inputs are disabled when toggle is off
    await expect(app.admin.setting('IntuneSettings.AuthService').choiceCombobox).toBeDisabled();
    await expect(app.admin.setting('IntuneSettings.TenantId').valueTextbox).toBeDisabled();
    await expect(app.admin.setting('IntuneSettings.ClientId').valueTextbox).toBeDisabled();

    // # Enable Intune
    await app.admin.setting('IntuneSettings.Enable').trueRadio.check();
    await expect(app.admin.setting('IntuneSettings.Enable').trueRadio).toBeChecked();

    // * Verify Intune inputs are now enabled
    await expect(app.admin.setting('IntuneSettings.AuthService').choiceCombobox).toBeEnabled();
    await expect(app.admin.setting('IntuneSettings.TenantId').valueTextbox).toBeEnabled();
    await expect(app.admin.setting('IntuneSettings.ClientId').valueTextbox).toBeEnabled();
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
        const {app} = await pw.testBrowser.login(adminUser);

        // # Go to Mobile Security section
        await openMobileSecurity(app);

        // * Verify Mobile Ephemeral Mode toggle is off by default
        await expect(app.admin.setting('MobileEphemeralModeSettings.Enable').falseRadio).toBeChecked();

        // * Verify all sub-settings are disabled
        await expect(
            app.admin.setting('MobileEphemeralModeSettings.DisconnectionTimeoutSeconds').numberSpinButton,
        ).toBeDisabled();
        await expect(
            app.admin.setting('MobileEphemeralModeSettings.OfflinePersistenceTimerHours').numberSpinButton,
        ).toBeDisabled();
        await expect(
            app.admin.setting('MobileEphemeralModeSettings.AutoCacheCleanupDays').numberSpinButton,
        ).toBeDisabled();

        // # Enable Mobile Ephemeral Mode toggle
        await app.admin.setting('MobileEphemeralModeSettings.Enable').trueRadio.check();
        await expect(app.admin.setting('MobileEphemeralModeSettings.Enable').trueRadio).toBeChecked();

        // * Verify all sub-settings are now enabled
        await expect(
            app.admin.setting('MobileEphemeralModeSettings.DisconnectionTimeoutSeconds').numberSpinButton,
        ).toBeEnabled();
        await expect(
            app.admin.setting('MobileEphemeralModeSettings.OfflinePersistenceTimerHours').numberSpinButton,
        ).toBeEnabled();
        await expect(
            app.admin.setting('MobileEphemeralModeSettings.AutoCacheCleanupDays').numberSpinButton,
        ).toBeEnabled();
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
        const {app} = await pw.testBrowser.login(adminUser);

        // # Go to Mobile Security section
        await openMobileSecurity(app);

        // # Set custom values
        await app.admin.setting('MobileEphemeralModeSettings.DisconnectionTimeoutSeconds').numberSpinButton.fill('120');
        await app.admin.setting('MobileEphemeralModeSettings.OfflinePersistenceTimerHours').numberSpinButton.fill('48');
        await app.admin.setting('MobileEphemeralModeSettings.AutoCacheCleanupDays').numberSpinButton.fill('14');

        // # Save settings
        await settle(app.admin.saveButton, {wait: Api.PatchConfig}).click();
        await expect(app.admin.saveButton).toBeSaved();

        // # Navigate away and back
        await openUsers(app);
        await openMobileSecurity(app);

        // * Verify Mobile Ephemeral Mode is still enabled
        await expect(app.admin.setting('MobileEphemeralModeSettings.Enable').trueRadio).toBeChecked();

        // * Verify all values persisted correctly
        await expect(
            app.admin.setting('MobileEphemeralModeSettings.DisconnectionTimeoutSeconds').numberSpinButton,
        ).toHaveValue('120');
        await expect(
            app.admin.setting('MobileEphemeralModeSettings.OfflinePersistenceTimerHours').numberSpinButton,
        ).toHaveValue('48');
        await expect(
            app.admin.setting('MobileEphemeralModeSettings.AutoCacheCleanupDays').numberSpinButton,
        ).toHaveValue('14');
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
        const {app} = await pw.testBrowser.login(adminUser);

        // # Go to Mobile Security section
        await openMobileSecurity(app);

        // * Verify offline persistence timer is enabled
        await expect(
            app.admin.setting('MobileEphemeralModeSettings.OfflinePersistenceTimerHours').numberSpinButton,
        ).toBeEnabled();

        // # Set auto cache cleanup to 0
        await app.admin.setting('MobileEphemeralModeSettings.AutoCacheCleanupDays').numberSpinButton.clear();
        await app.admin.setting('MobileEphemeralModeSettings.AutoCacheCleanupDays').numberSpinButton.fill('0');

        // * Verify offline persistence timer is now disabled
        await expect(
            app.admin.setting('MobileEphemeralModeSettings.OfflinePersistenceTimerHours').numberSpinButton,
        ).toBeDisabled();

        // # Set auto cache cleanup back to 7
        await app.admin.setting('MobileEphemeralModeSettings.AutoCacheCleanupDays').numberSpinButton.clear();
        await app.admin.setting('MobileEphemeralModeSettings.AutoCacheCleanupDays').numberSpinButton.fill('7');

        // * Verify offline persistence timer is enabled again
        await expect(
            app.admin.setting('MobileEphemeralModeSettings.OfflinePersistenceTimerHours').numberSpinButton,
        ).toBeEnabled();
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
        const {app} = await pw.testBrowser.login(adminUser);

        // # Go to Mobile Security section
        await openMobileSecurity(app);

        // # Enable Mobile Ephemeral Mode
        await app.admin.setting('MobileEphemeralModeSettings.Enable').trueRadio.check();
        await expect(app.admin.setting('MobileEphemeralModeSettings.Enable').trueRadio).toBeChecked();

        // * Verify default values
        await expect(
            app.admin.setting('MobileEphemeralModeSettings.DisconnectionTimeoutSeconds').numberSpinButton,
        ).toHaveValue('60');
        await expect(
            app.admin.setting('MobileEphemeralModeSettings.OfflinePersistenceTimerHours').numberSpinButton,
        ).toHaveValue('24');
        await expect(
            app.admin.setting('MobileEphemeralModeSettings.AutoCacheCleanupDays').numberSpinButton,
        ).toHaveValue('7');
    },
);
