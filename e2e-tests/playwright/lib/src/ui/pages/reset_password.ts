// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Page} from '@playwright/test';
import {expect} from '@playwright/test';

import {components} from '@/ui/components';

import {BasePage} from '../base_page';
import type {BaseComponent} from '../base_component';

export default class ResetPasswordPage extends BasePage {
    readonly components: Record<string, BaseComponent>;

    readonly title;
    readonly subtitle;
    readonly emailInput;
    readonly resetButton;
    readonly formContainer;

    readonly header;
    readonly footer;

    constructor(page: Page) {
        super(page);

        this.title = page.locator('h1:has-text("Password Reset")');
        this.subtitle = page.locator('text=To reset your password, enter the email address you used to sign up');
        this.emailInput = page.locator('#passwordResetEmailInput');
        this.resetButton = page.locator('#passwordResetButton');
        this.formContainer = page.getByTestId('signupTeamContainer');

        this.header = new components.MainHeader(page.getByTestId('signupHeader'));
        this.footer = new components.Footer(page.locator('#footer_section'));

        this.components = {header: this.header, footer: this.footer};
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
