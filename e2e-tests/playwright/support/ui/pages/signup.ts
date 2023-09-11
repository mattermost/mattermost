// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, Page} from '@playwright/test';

import {duration, wait} from '@e2e-support/util';
import {components} from '@e2e-support/ui/components';

export default class SignupPage {
    readonly page: Page;

    readonly title;
    readonly subtitle;
    readonly bodyCard;
    readonly emailInput;
    readonly usernameInput;
    readonly passwordInput;
    readonly passwordToggleButton;
    readonly newsLetterCheckBox;
    readonly newsLetterPrivacyPolicyLink;
    readonly newsLetterUnsubscribeLink;
    readonly agreementTermsOfUseLink;
    readonly agreementPrivacyPolicyLink;
    readonly createAccountButton;
    readonly loginLink;
    readonly emailError;
    readonly usernameError;
    readonly passwordError;

    readonly header;
    readonly footer;

    constructor(page: Page) {
        this.page = page;

        this.title = page.locator('h1:has-text("Let’s get started")');
        this.subtitle = page.locator('text=Create your Mattermost account to start collaborating with your team');
        this.bodyCard = page.locator('.signup-body-card-content');
        this.loginLink = page.locator('text=Log in');
        this.emailInput = page.locator('#input_email');
        this.usernameInput = page.locator('#input_name');
        this.passwordInput = page.locator('#input_password-input');
        this.passwordToggleButton = page.getByRole('button', {name: 'Show or hide password'});
        this.createAccountButton = page.locator('button:has-text("Create Account")');
        this.emailError = page.locator('text=Please enter a valid email address');
        this.usernameError = page.locator(
            'text=Usernames have to begin with a lowercase letter and be 3-22 characters long. You can use lowercase letters, numbers, periods, dashes, and underscores.'
        );
        this.passwordError = page.locator('text=Must be 5-64 characters long.');

        const newsletterBlock = page.locator('.check-input');
        this.newsLetterCheckBox = newsletterBlock.getByRole('checkbox', {name: 'newsletter checkbox'});
        this.newsLetterPrivacyPolicyLink = newsletterBlock.locator('text=Privacy Policy');
        this.newsLetterUnsubscribeLink = newsletterBlock.locator('text=unsubscribe');

        const agreementBlock = page.locator('.signup-body-card-agreement');
        this.agreementTermsOfUseLink = agreementBlock.locator('text=Terms of Use');
        this.agreementPrivacyPolicyLink = agreementBlock.locator('text=Privacy Policy');

        this.header = new components.MainHeader(page.locator('.hfroute-header'));
        this.footer = new components.Footer(page.locator('.hfroute-footer'));
    }

    async toBeVisible() {
        await this.page.waitForLoadState('networkidle');
        await this.page.waitForLoadState('domcontentloaded');
        await wait(duration.half_sec);
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
        await this.createAccountButton.click();

        if (waitForRedirect) {
            await this.page.waitForNavigation();
        }
    }
}

export {SignupPage};
