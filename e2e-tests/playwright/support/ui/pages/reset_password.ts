// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, Page} from '@playwright/test';

import {components} from '@e2e-support/ui/components';

export default class ResetPasswordPage {
    readonly page: Page;

    readonly title;
    readonly subtitle;
    readonly emailInput;
    readonly resetButton;
    readonly formContainer;

    readonly header;
    readonly footer;

    constructor(page: Page) {
        this.page = page;

        this.title = page.locator('h1:has-text("Password Reset")');
        this.subtitle = page.locator('text=To reset your password, enter the email address you used to sign up');
        this.emailInput = page.locator(`[placeholder="Email"]`);
        this.resetButton = page.locator('#passwordResetButton');
        this.formContainer = page.locator('.signup-team__container');

        this.header = new components.MainHeader(page.locator('.signup-header'));
        this.footer = new components.Footer(page.locator('#footer_section'));
    }

    async toBeVisible() {
        await this.page.waitForLoadState('networkidle');
        await expect(this.title).toBeVisible();
        await expect(this.subtitle).toBeVisible();
        await expect(this.emailInput).toBeVisible();
        await expect(this.resetButton).toBeVisible();
    }

    async goto() {
        await this.page.goto('/reset_password');
    }

    async reset(email: string) {
        await this.emailInput.fill(email);
        await Promise.all([this.page.waitForNavigation(), this.resetButton.click()]);
    }
}

export {ResetPasswordPage};
