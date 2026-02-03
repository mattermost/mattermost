// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, Locator, Page} from '@playwright/test';

/**
 * System Console -> Environment -> Mobile Security
 */
export default class MobileSecurity {
    readonly page: Page;
    readonly container: Locator;

    readonly enableBiometricAuthenticationToggleTrue: Locator;
    readonly enableBiometricAuthenticationToggleFalse: Locator;
    readonly preventScreenCaptureToggleTrue: Locator;
    readonly preventScreenCaptureToggleFalse: Locator;
    readonly jailbreakProtectionToggleTrue: Locator;
    readonly jailbreakProtectionToggleFalse: Locator;
    readonly enableSecureFilePreviewToggleTrue: Locator;
    readonly enableSecureFilePreviewToggleFalse: Locator;
    readonly allowPdfLinkNavigationToggleTrue: Locator;
    readonly allowPdfLinkNavigationToggleFalse: Locator;
    readonly enableIntuneMAMToggleTrue: Locator;
    readonly enableIntuneMAMToggleFalse: Locator;

    // New IntuneSettings fields
    readonly enableIntuneToggleTrue: Locator;
    readonly enableIntuneToggleFalse: Locator;
    readonly intuneAuthServiceDropdown: Locator;
    readonly intuneTenantIdInput: Locator;
    readonly intuneClientIdInput: Locator;
    readonly intuneTenantIdRequiredError: Locator;

    readonly saveButton: Locator;

    constructor(container: Locator, page: Page) {
        this.container = container;
        this.page = page;

        this.enableBiometricAuthenticationToggleTrue = this.container.getByTestId(
            'NativeAppSettings.MobileEnableBiometricstrue',
        );
        this.enableBiometricAuthenticationToggleFalse = this.container.getByTestId(
            'NativeAppSettings.MobileEnableBiometricsfalse',
        );

        this.preventScreenCaptureToggleTrue = this.container.getByTestId(
            'NativeAppSettings.MobilePreventScreenCapturetrue',
        );
        this.preventScreenCaptureToggleFalse = this.container.getByTestId(
            'NativeAppSettings.MobilePreventScreenCapturefalse',
        );

        this.jailbreakProtectionToggleTrue = this.container.getByTestId(
            'NativeAppSettings.MobileJailbreakProtectiontrue',
        );
        this.jailbreakProtectionToggleFalse = this.container.getByTestId(
            'NativeAppSettings.MobileJailbreakProtectionfalse',
        );

        this.jailbreakProtectionToggleTrue = this.container.getByTestId(
            'NativeAppSettings.MobileJailbreakProtectiontrue',
        );
        this.jailbreakProtectionToggleFalse = this.container.getByTestId(
            'NativeAppSettings.MobileJailbreakProtectionfalse',
        );

        this.enableSecureFilePreviewToggleTrue = this.container.getByTestId(
            'NativeAppSettings.MobileEnableSecureFilePreviewtrue',
        );
        this.enableSecureFilePreviewToggleFalse = this.container.getByTestId(
            'NativeAppSettings.MobileEnableSecureFilePreviewfalse',
        );

        this.allowPdfLinkNavigationToggleTrue = this.container.getByTestId(
            'NativeAppSettings.MobileAllowPdfLinkNavigationtrue',
        );
        this.allowPdfLinkNavigationToggleFalse = this.container.getByTestId(
            'NativeAppSettings.MobileAllowPdfLinkNavigationfalse',
        );

        // Legacy Intune toggle (will be removed in Phase 6)
        this.enableIntuneMAMToggleTrue = this.container.getByTestId('IntuneSettings.Enabletrue');
        this.enableIntuneMAMToggleFalse = this.container.getByTestId('IntuneSettings.Enablefalse');

        // New IntuneSettings fields
        this.enableIntuneToggleTrue = this.container.getByTestId('IntuneSettings.Enabletrue');
        this.enableIntuneToggleFalse = this.container.getByTestId('IntuneSettings.Enablefalse');
        this.intuneAuthServiceDropdown = this.container.getByTestId('IntuneSettings.AuthServicedropdown');
        this.intuneTenantIdInput = this.container.getByTestId('IntuneSettings.TenantIdinput');
        this.intuneClientIdInput = this.container.getByTestId('IntuneSettings.ClientIdinput');
        this.intuneTenantIdRequiredError = this.container.getByTestId('errorMessage');

        this.saveButton = this.container.getByRole('button', {name: 'Save'});
    }

    async discardChanges() {
        this.page.getByRole('button', {name: 'Yes, Discard'}).click();
    }

    async intuneTenantIdRequiredErrorToBeVisible() {
        await expect(this.intuneTenantIdRequiredError).toBeVisible();
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }

    async clickEnableBiometricAuthenticationToggleTrue() {
        await this.enableBiometricAuthenticationToggleTrue.click();
    }

    async clickEnableBiometricAuthenticationToggleFalse() {
        await this.enableBiometricAuthenticationToggleFalse.click();
    }

    async clickPreventScreenCaptureToggleTrue() {
        await this.preventScreenCaptureToggleTrue.click();
    }

    async clickPreventScreenCaptureToggleFalse() {
        await this.preventScreenCaptureToggleFalse.click();
    }

    async clickJailbreakProtectionToggleTrue() {
        await this.jailbreakProtectionToggleTrue.click();
    }

    async clickJailbreakProtectionToggleFalse() {
        await this.jailbreakProtectionToggleFalse.click();
    }

    async clickEnableSecureFilePreviewToggleTrue() {
        await this.enableSecureFilePreviewToggleTrue.click();
    }

    async clickEnableSecureFilePreviewToggleFalse() {
        await this.enableSecureFilePreviewToggleFalse.click();
    }

    async clickAllowPdfLinkNavigationToggleTrue() {
        await this.allowPdfLinkNavigationToggleTrue.click();
    }

    async clickAllowPdfLinkNavigationToggleFalse() {
        await this.allowPdfLinkNavigationToggleFalse.click();
    }

    async clickEnableIntuneMAMToggleTrue() {
        await this.enableIntuneMAMToggleTrue.click();
    }

    async selectAuthProvider(value: 'office365' | 'saml') {
        await this.intuneAuthServiceDropdown.selectOption(value);
    }

    async clickEnableIntuneMAMToggleFalse() {
        await this.enableIntuneMAMToggleFalse.click();
    }

    // New IntuneSettings methods
    async clickEnableIntuneToggleTrue() {
        await this.enableIntuneToggleTrue.click();
    }

    async clickEnableIntuneToggleFalse() {
        await this.enableIntuneToggleFalse.click();
    }

    async selectIntuneAuthService(value: 'office365' | 'saml') {
        await this.intuneAuthServiceDropdown.selectOption(value);
    }

    async fillIntuneTenantId(value: string) {
        await this.intuneTenantIdInput.fill(value);
    }

    async fillIntuneClientId(value: string) {
        await this.intuneClientIdInput.fill(value);
    }

    async clickSaveButton() {
        await this.saveButton.click();
    }
}
