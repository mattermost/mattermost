// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Page} from '@playwright/test';
import {expect} from '@playwright/test';

export default class EmailToOAuthPage {
    readonly page: Page;
    readonly title;
    readonly passwordInput;
    readonly submitButton;
    readonly invalidPasswordError;

    constructor(page: Page) {
        this.page = page;
        this.title = page.getByRole('heading', {name: /Switch Email\/Password Account to .+ SSO/});
        this.passwordInput = page.locator('#claim input[name="password"]');
        this.submitButton = page.getByRole('button', {name: /Switch Account to .+ SSO/});
        this.invalidPasswordError = page.getByText('Login failed because of invalid password.');
    }

    async toBeVisible() {
        await expect(this.title).toBeVisible();
        await expect(this.passwordInput).toBeVisible();
    }

    async submit(password: string) {
        await this.passwordInput.fill(password);
        await this.submitButton.click();
    }
}
