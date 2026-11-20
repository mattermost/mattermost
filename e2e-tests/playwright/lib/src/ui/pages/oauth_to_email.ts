// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Page} from '@playwright/test';
import {expect} from '@playwright/test';

export default class OAuthToEmailPage {
    readonly page: Page;
    readonly title;
    readonly passwordInput;
    readonly confirmPasswordInput;
    readonly submitButton;

    constructor(page: Page) {
        this.page = page;
        this.title = page.getByRole('heading', {name: /Switch .+ Account to Email/});
        this.passwordInput = page.locator('#claim input[name="password"]');
        this.confirmPasswordInput = page.locator('#claim input[name="passwordconfirm"]');
        this.submitButton = page.getByRole('button', {name: /Switch .+ to Email and Password/});
    }

    async toBeVisible() {
        await expect(this.title).toBeVisible();
        await expect(this.passwordInput).toBeVisible();
    }

    async submit(password: string) {
        await this.passwordInput.fill(password);
        await this.confirmPasswordInput.fill(password);
        await this.submitButton.click();
    }
}
