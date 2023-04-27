// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, Page} from '@playwright/test';

import {AdminConfig} from '@mattermost/types/config';
import {UserProfile} from '@mattermost/types/users';

export default class LoginPage {
    readonly adminConfig: AdminConfig;

    readonly page: Page;

    readonly title;
    readonly subtitle;
    readonly bodyCard;
    readonly loginInput;
    readonly loginPlaceholder;
    readonly passwordInput;
    readonly signInButton;
    readonly createAccountLink;
    readonly forgotPasswordLink;
    readonly userErrorLabel;
    readonly fieldWithError;
    readonly formContainer;

    constructor(page: Page, adminConfig: AdminConfig) {
        this.page = page;
        this.adminConfig = adminConfig;

        const loginInputPlaceholder = adminConfig.LdapSettings.Enable
            ? 'Email, Username or AD/LDAP Username'
            : 'Email or Username';

        this.title = page.locator('h1:has-text("Log in to your account")');
        this.subtitle = page.locator('text=Collaborate with your team in real-time');
        this.bodyCard = page.locator('.login-body-card');
        this.loginInput = page.locator('#input_loginId');
        this.loginPlaceholder = page.locator(`[placeholder="${loginInputPlaceholder}"]`);
        this.passwordInput = page.locator('#input_password-input');
        this.signInButton = page.locator('button:has-text("Log in")');
        this.createAccountLink = page.locator("text=Don't have an account?");
        this.forgotPasswordLink = page.locator('text=Forgot your password?');
        this.userErrorLabel = page.locator('text=Please enter your email or username');
        this.fieldWithError = page.locator('.with-error');
        this.formContainer = page.locator('.signup-team__container');
    }

    async toBeVisible() {
        await this.page.waitForLoadState('networkidle');
        await expect(this.title).toBeVisible();
        await expect(this.loginInput).toBeVisible();
        await expect(this.passwordInput).toBeVisible();
    }

    async goto() {
        await this.page.goto('/login');
    }

    async login(user: UserProfile, useUsername = true) {
        await this.loginInput.fill(useUsername ? user.username : user.email);
        await this.passwordInput.fill(user.password);
        await Promise.all([this.page.waitForNavigation(), this.signInButton.click()]);
    }
}

export {LoginPage};
