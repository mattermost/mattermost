// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Locator, expect} from '@playwright/test';

import {RadioSetting, TextInputSetting, DropdownSetting, AdminSectionPanel} from '../../base_components';

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
