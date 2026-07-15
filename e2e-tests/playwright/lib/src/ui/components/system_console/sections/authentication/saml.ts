// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Page} from '@playwright/test';
import {expect} from '@playwright/test';

import {duration} from '@/util';

/**
 * System Console -> Authentication -> SAML 2.0.
 */
export default class Saml {
    readonly page: Page;

    constructor(page: Page) {
        this.page = page;
    }

    async goto() {
        await this.page.goto('/admin_console/authentication/saml');
        await expect(this.page.getByRole('group', {name: 'Enable Login With SAML 2.0:', exact: true})).toBeVisible({
            timeout: duration.half_min,
        });
    }

    async setGuestAttribute(value: string) {
        await this.page.getByRole('textbox', {name: 'Guest Attribute:', exact: true}).fill(value);
        await this.save();
    }

    async expectGuestAttributeDisabled() {
        await expect(this.page.getByRole('textbox', {name: 'Guest Attribute:', exact: true})).toBeDisabled();
    }

    async expectMetadataURL(value: string, enabled = true) {
        const input = this.page.getByRole('textbox', {name: 'Identity Provider Metadata URL:', exact: true});
        await expect(input).toHaveValue(value);
        if (enabled) {
            await expect(input).toBeEnabled();
        }
    }

    async setMetadataURL(value: string) {
        await this.page.getByRole('textbox', {name: 'Identity Provider Metadata URL:', exact: true}).fill(value);
    }

    async getMetadata() {
        await this.page.getByRole('button', {name: 'Get SAML Metadata from IdP', exact: true}).click();
    }

    async expectGetMetadataEnabled(enabled: boolean) {
        const button = this.page.getByRole('button', {name: 'Get SAML Metadata from IdP', exact: true});
        if (enabled) {
            await expect(button).toBeEnabled();
        } else {
            await expect(button).toBeDisabled();
        }
    }

    async expectMetadataMessage(message: string) {
        await expect(this.page.getByText(message, {exact: true})).toBeVisible({timeout: duration.half_min});
    }

    async expectIdentityProviderValues(ssoURL: string, issuerURL: string, serviceProviderIdentifier?: string) {
        await expect(this.page.getByRole('textbox', {name: 'SAML SSO URL:', exact: true})).toHaveValue(ssoURL);
        await expect(this.page.getByRole('textbox', {name: 'Identity Provider Issuer URL:', exact: true})).toHaveValue(
            issuerURL,
        );
        if (serviceProviderIdentifier !== undefined) {
            await expect(
                this.page.getByRole('textbox', {name: 'Service Provider Identifier:', exact: true}),
            ).toHaveValue(serviceProviderIdentifier);
        }
    }

    async expectIdentityProviderCertificate() {
        await expect(this.page.getByText('saml-idp.crt', {exact: true})).toBeVisible();
        await expect(
            this.page.getByRole('button', {name: 'Remove Identity Provider Certificate', exact: true}),
        ).toBeVisible();
    }

    async save() {
        const button = this.page.getByRole('button', {name: 'Save', exact: true});
        await button.click();
        await expect(button).toBeDisabled({timeout: duration.half_min});
    }
}
