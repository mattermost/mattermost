// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

import {BaseComponent} from '@/ui/base_component';
import en from '@/i18n';

import {RadioSetting, TextInputSetting, NumberInputSetting, DropdownSetting} from '../../base_components';

/**
 * System Console -> Environment -> Mobile Security
 */
export default class MobileSecurity extends BaseComponent {
    readonly header: Locator;

    readonly generalMobileSecurity: GeneralMobileSecurityPanel;
    readonly microsoftIntune: MicrosoftIntunePanel;
    readonly mobileEphemeralMode: MobileEphemeralModePanel;

    readonly saveButton: Locator;
    readonly errorMessage: Locator;

    constructor(container: Locator) {
        super(container);

        this.header = container.getByText(en['admin.mobileSecurity.title'], {exact: true});

        this.generalMobileSecurity = new GeneralMobileSecurityPanel(
            container.getByTestId('MobileSecuritySettings.General'),
        );
        this.microsoftIntune = new MicrosoftIntunePanel(container.getByTestId('MobileSecuritySettings.Intune'));
        this.mobileEphemeralMode = new MobileEphemeralModePanel(
            container.getByTestId('MobileSecuritySettings.EphemeralMode'),
        );

        this.saveButton = container.getByTestId('saveSetting');
        this.errorMessage = container.getByTestId('errorMessage');
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
        await expect(this.header).toBeVisible();
    }

    async save() {
        await this.saveButton.click();
    }

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

class GeneralMobileSecurityPanel extends BaseComponent {
    readonly enableBiometricAuthentication: RadioSetting;
    readonly preventScreenCapture: RadioSetting;
    readonly enableJailbreakProtection: RadioSetting;
    readonly enableSecureFilePreviewMode: RadioSetting;
    readonly allowPdfLinkNavigation: RadioSetting;

    constructor(container: Locator) {
        super(container);

        this.enableBiometricAuthentication = new RadioSetting(
            container.getByTestId('NativeAppSettings.MobileEnableBiometrics'),
        );
        this.preventScreenCapture = new RadioSetting(
            container.getByTestId('NativeAppSettings.MobilePreventScreenCapture'),
        );
        this.enableJailbreakProtection = new RadioSetting(
            container.getByTestId('NativeAppSettings.MobileJailbreakProtection'),
        );
        this.enableSecureFilePreviewMode = new RadioSetting(
            container.getByTestId('NativeAppSettings.MobileEnableSecureFilePreview'),
        );
        this.allowPdfLinkNavigation = new RadioSetting(
            container.getByTestId('NativeAppSettings.MobileAllowPdfLinkNavigation'),
        );
    }
}

class MobileEphemeralModePanel extends BaseComponent {
    readonly enableMobileEphemeralMode: RadioSetting;
    readonly disconnectionTimeout: NumberInputSetting;
    readonly offlinePersistenceTimer: NumberInputSetting;
    readonly autoCacheCleanup: NumberInputSetting;

    constructor(container: Locator) {
        super(container);

        this.enableMobileEphemeralMode = new RadioSetting(container.getByTestId('MobileEphemeralModeSettings.Enable'));
        this.disconnectionTimeout = new NumberInputSetting(
            container.getByTestId('MobileEphemeralModeSettings.DisconnectionTimeoutSeconds'),
            en['admin.mobileSecurity.ephemeralMode.disconnectionTimeoutTitle'],
        );
        this.offlinePersistenceTimer = new NumberInputSetting(
            container.getByTestId('MobileEphemeralModeSettings.OfflinePersistenceTimerHours'),
            en['admin.mobileSecurity.ephemeralMode.offlinePersistenceTitle'],
        );
        this.autoCacheCleanup = new NumberInputSetting(
            container.getByTestId('MobileEphemeralModeSettings.AutoCacheCleanupDays'),
            en['admin.mobileSecurity.ephemeralMode.autoCacheCleanupTitle'],
        );
    }
}

class MicrosoftIntunePanel extends BaseComponent {
    readonly enableIntuneMAM: RadioSetting;
    readonly authProvider: DropdownSetting;
    readonly tenantId: TextInputSetting;
    readonly clientId: TextInputSetting;

    constructor(container: Locator) {
        super(container);

        this.enableIntuneMAM = new RadioSetting(container.getByTestId('IntuneSettings.Enable'));
        this.authProvider = new DropdownSetting(
            container.getByTestId('IntuneSettings.AuthService'),
            en['admin.intune.authServiceTitle'],
        );
        this.tenantId = new TextInputSetting(
            container.getByTestId('IntuneSettings.TenantId'),
            en['admin.intune.tenantIdTitle'],
        );
        this.clientId = new TextInputSetting(
            container.getByTestId('IntuneSettings.ClientId'),
            en['admin.intune.clientIdTitle'],
        );
    }
}
