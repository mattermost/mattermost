// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, Locator} from '@playwright/test';

/**
 * System Console -> Environment -> Mobile Security
 */
export default class MobileSecurity {
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

    readonly saveButton: Locator;

    constructor(container: Locator) {
        this.container = container;

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

        this.saveButton = this.container.getByRole('button', {name: 'Save'});
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

    async clickSaveButton() {
        await this.saveButton.click();
    }
}
