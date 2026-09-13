// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Page} from '@playwright/test';
import {expect} from '@playwright/test';

export default class LdapToEmailPage {
    readonly page: Page;
    readonly title;
    readonly ldapPasswordInput;
    readonly passwordInput;
    readonly confirmPasswordInput;
    readonly submitButton;
    readonly mfaTokenInput;
    readonly mfaSubmitButton;

    constructor(page: Page) {
        this.page = page;
        this.title = page.getByRole('heading', {name: 'Switch AD/LDAP Account to Email/Password'});
        this.ldapPasswordInput = page.locator('#claim input[name="ldapPassword"]');
        this.passwordInput = page.locator('#claim input[name="password"]');
        this.confirmPasswordInput = page.locator('#claim input[name="passwordconfirm"]');
        this.submitButton = page.getByRole('button', {name: 'Switch account to email/password'});
        this.mfaTokenInput = page.getByPlaceholder('MFA Token');
        this.mfaSubmitButton = page.getByRole('button', {name: 'Submit'});
    }

    async toBeVisible() {
        await expect(this.title).toBeVisible();
        await expect(this.ldapPasswordInput.or(this.mfaTokenInput)).toBeVisible();

        // The page currently opens on the MFA interstitial; a dummy token reveals the form.
        if (await this.mfaTokenInput.isVisible()) {
            await this.mfaTokenInput.fill('000000');
            await this.mfaSubmitButton.click();
            await expect(this.ldapPasswordInput).toBeVisible();
        }
    }

    async submit(ldapPassword: string, newPassword: string) {
        await this.ldapPasswordInput.fill(ldapPassword);
        await this.passwordInput.fill(newPassword);
        await this.confirmPasswordInput.fill(newPassword);
        await this.submitButton.click();
    }
}
