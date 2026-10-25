// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Page} from '@playwright/test';
import {expect} from '@playwright/test';

export default class EmailToLdapPage {
    readonly page: Page;
    readonly title;
    readonly emailPasswordInput;
    readonly ldapIdInput;
    readonly ldapPasswordInput;
    readonly submitButton;
    readonly invalidPasswordError;

    constructor(page: Page) {
        this.page = page;
        this.title = page.getByRole('heading', {name: 'Switch Email/Password Account to AD/LDAP'});
        this.emailPasswordInput = page.locator('#claim input[name="emailPassword"]');
        this.ldapIdInput = page.locator('#claim input[name="ldapId"]');
        this.ldapPasswordInput = page.locator('#claim input[name="ldapPassword"]');
        this.submitButton = page.getByRole('button', {name: 'Switch Account to AD/LDAP'});
        this.invalidPasswordError = page.getByText('Login failed because of invalid password.');
    }

    async toBeVisible() {
        await expect(this.title).toBeVisible();
        await expect(this.emailPasswordInput).toBeVisible();
    }

    async submit(emailPassword: string, ldapId: string, ldapPassword: string) {
        await this.emailPasswordInput.fill(emailPassword);
        await this.ldapIdInput.fill(ldapId);
        await this.ldapPasswordInput.fill(ldapPassword);
        await this.submitButton.click();
    }
}
