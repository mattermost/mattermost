// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

import {
    RadioSetting,
    TextInputSetting,
    NumberInputSetting,
    DropdownSetting,
    AdminSectionPanel,
} from '../../base_components';

/**
 * System Console -> Environment -> Mobile Security
 */
export default class MobileSecurity {
    readonly container: Locator;

    // Header
    readonly header: Locator;

    // Panels
    readonly generalMobileSecurity: GeneralMobileSecurityPanel;
    readonly microsoftIntune: MicrosoftIntunePanel;
    readonly mobileEphemeralMode: MobileEphemeralModePanel;

    // Save section
    readonly saveButton: Locator;
    readonly errorMessage: Locator;

    constructor(container: Locator) {
        this.container = container;

        this.header = container.getByText('Mobile Security', {exact: true});

        this.generalMobileSecurity = new GeneralMobileSecurityPanel(
            container.locator('.AdminSectionPanel').filter({hasText: 'General Mobile Security'}),
        );
        this.microsoftIntune = new MicrosoftIntunePanel(
            container.locator('.AdminSectionPanel').filter({hasText: 'Microsoft Intune'}),
        );
        this.mobileEphemeralMode = new MobileEphemeralModePanel(
            container.locator('.AdminSectionPanel').filter({hasText: 'Mobile Ephemeral Mode'}),
        );

        this.saveButton = container.getByRole('button', {name: 'Save'});
        this.errorMessage = container.locator('.error-message');
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
        await expect(this.header).toBeVisible();
    }

    async save() {
        await this.saveButton.click();
    }

    // Convenience shortcuts for General Mobile Security settings
    get enableBiometricAuthentication() {
        return this.generalMobileSecurity.enableBiometricAuthentication;
    }
    get preventScreenCapture() {
        return this.generalMobileSecurity.preventScreenCapture;
    }
    get enableJailbreakProtection() {
        return this.generalMobileSecurity.enableJailbreakProtection;
    }
    get enableSecureFilePreviewMode() {
        return this.generalMobileSecurity.enableSecureFilePreviewMode;
    }
    get allowPdfLinkNavigation() {
        return this.generalMobileSecurity.allowPdfLinkNavigation;
    }

    // Convenience shortcuts for Microsoft Intune settings
    get enableIntuneMAM() {
        return this.microsoftIntune.enableIntuneMAM;
    }
    get authProvider() {
        return this.microsoftIntune.authProvider;
    }
    get tenantId() {
        return this.microsoftIntune.tenantId;
    }
    get clientId() {
        return this.microsoftIntune.clientId;
    }

    // Convenience shortcuts for Mobile Ephemeral Mode settings
    get enableMobileEphemeralMode() {
        return this.mobileEphemeralMode.enableMobileEphemeralMode;
    }
    get disconnectionTimeout() {
        return this.mobileEphemeralMode.disconnectionTimeout;
    }
    get offlinePersistenceTimer() {
        return this.mobileEphemeralMode.offlinePersistenceTimer;
    }
    get autoCacheCleanup() {
        return this.mobileEphemeralMode.autoCacheCleanup;
    }
}

class GeneralMobileSecurityPanel extends AdminSectionPanel {
    readonly enableBiometricAuthentication: RadioSetting;
    readonly preventScreenCapture: RadioSetting;
    readonly enableJailbreakProtection: RadioSetting;
    readonly enableSecureFilePreviewMode: RadioSetting;
    readonly allowPdfLinkNavigation: RadioSetting;

    constructor(container: Locator) {
        super(container, 'General Mobile Security');

        this.enableBiometricAuthentication = new RadioSetting(
            this.body.getByRole('group', {name: /Enable Biometric Authentication/}),
        );
        this.preventScreenCapture = new RadioSetting(this.body.getByRole('group', {name: /Prevent Screen Capture/}));
        this.enableJailbreakProtection = new RadioSetting(
            this.body.getByRole('group', {name: /Enable Jailbreak\/Root Protection/}),
        );
        this.enableSecureFilePreviewMode = new RadioSetting(
            this.body.getByRole('group', {name: /Enable Secure File Preview Mode/}),
        );
        this.allowPdfLinkNavigation = new RadioSetting(
            this.body.getByRole('group', {name: /Allow Link Navigation in Secure PDFs/}),
        );
    }
}

class MobileEphemeralModePanel extends AdminSectionPanel {
    readonly enableMobileEphemeralMode: RadioSetting;
    readonly disconnectionTimeout: NumberInputSetting;
    readonly offlinePersistenceTimer: NumberInputSetting;
    readonly autoCacheCleanup: NumberInputSetting;

    constructor(container: Locator) {
        super(container, 'Mobile Ephemeral Mode');

        this.enableMobileEphemeralMode = new RadioSetting(
            this.body.getByRole('group', {name: /Enable Mobile Ephemeral Mode/}),
        );
        this.disconnectionTimeout = new NumberInputSetting(
            this.body.locator('.form-group').filter({hasText: 'Disconnection Timeout (seconds):'}),
            'Disconnection Timeout (seconds):',
        );
        this.offlinePersistenceTimer = new NumberInputSetting(
            this.body.locator('.form-group').filter({hasText: 'Offline Persistence Timer (hours):'}),
            'Offline Persistence Timer (hours):',
        );
        this.autoCacheCleanup = new NumberInputSetting(
            this.body.locator('.form-group').filter({hasText: 'Auto Cache Cleanup (days):'}),
            'Auto Cache Cleanup (days):',
        );
    }
}

class MicrosoftIntunePanel extends AdminSectionPanel {
    readonly enableIntuneMAM: RadioSetting;
    readonly authProvider: DropdownSetting;
    readonly tenantId: TextInputSetting;
    readonly clientId: TextInputSetting;

    constructor(container: Locator) {
        super(container, 'Microsoft Intune');

        this.enableIntuneMAM = new RadioSetting(this.body.getByRole('group', {name: /Enable Microsoft Intune MAM/}));

        this.authProvider = new DropdownSetting(
            this.body.locator('.form-group').filter({hasText: 'Auth Provider:'}),
            'Auth Provider:',
        );
        this.tenantId = new TextInputSetting(
            this.body.locator('.form-group').filter({hasText: 'Tenant ID:'}),
            'Tenant ID:',
        );
        this.clientId = new TextInputSetting(
            this.body.locator('.form-group').filter({hasText: 'Application (Client) ID:'}),
            'Application (Client) ID:',
        );
    }
}
