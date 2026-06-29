// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Page} from '@playwright/test';
import {expect} from '@playwright/test';

import {components} from '@/ui/components';
import en from '@/i18n';

import type {BaseComponent} from '../base_component';
import {BasePage} from '../base_page';

export default class SignupPage extends BasePage {
    readonly components: Record<string, BaseComponent>;

    readonly title;
    readonly subtitle;
    readonly bodyCard;
    readonly emailInput;
    readonly usernameInput;
    readonly passwordInput;
    readonly passwordToggleButton;
    readonly termsAndPrivacyCheckBox;
    readonly termsAndPrivacyAcceptableUsePolicyLink;
    readonly termsAndPrivacyPrivacyPolicyLink;
    readonly createAccountButton;
    readonly loginLink;
    readonly emailError;
    readonly usernameError;
    readonly passwordError;

    readonly header;
    readonly footer;

    constructor(page: Page) {
        super(page);

        this.title = page.locator(`h1:has-text("${en['signup_user_completed.title']}")`);
        this.subtitle = page.locator('text=Create your Mattermost account to start collaborating with your team');
        this.bodyCard = page.getByTestId('signupBodyCard');
        this.loginLink = page.locator('text=Log in');
        this.emailInput = page.locator('#input_email');
        this.usernameInput = page.locator('#input_name');
        this.passwordInput = page.locator('#input_password-input');
        this.passwordToggleButton = page.locator('#password_toggle');
        this.createAccountButton = page.locator('button:has-text("Create account")');
        this.emailError = page.locator('text=Please enter a valid email address');
        this.usernameError = page.locator(
            'text=Usernames have to begin with a lowercase letter and be 3-22 characters long. You can use lowercase letters, numbers, periods, dashes, and underscores.',
        );
        this.passwordError = page.locator('text=/Must be \\d+-72 characters long\\./');

        this.termsAndPrivacyCheckBox = page.getByRole('checkbox', {
            name: en['signup.terms_and_privacy.checkmark.box'],
        });
        this.termsAndPrivacyAcceptableUsePolicyLink = page.locator('text=Acceptable Use Policy');
        this.termsAndPrivacyPrivacyPolicyLink = page.locator('text=Privacy Policy');

        this.header = new components.MainHeader(page.getByTestId('hfrouteHeader'));
        this.footer = new components.Footer(page.getByTestId('hfrouteFooter'));

        this.components = {header: this.header, footer: this.footer};
    }

    async toBeVisible() {
        await this.emailInput.waitFor({state: 'visible'});
        await expect(this.title).toBeVisible();
        await expect(this.emailInput).toBeVisible();
        await expect(this.usernameInput).toBeVisible();
        await expect(this.passwordInput).toBeVisible();
    }

    async goto() {
        await this.page.goto('/signup_user_complete');
    }

    async create(user: {email: string; username: string; password: string}, waitForRedirect = true) {
        await this.emailInput.fill(user.email);
        await this.usernameInput.fill(user.username);
        await this.passwordInput.fill(user.password);
        await this.termsAndPrivacyCheckBox.check();
        await this.createAccountButton.click();

        if (waitForRedirect) {
            await this.page.waitForNavigation();
        }
    }
}
