// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Page} from '@playwright/test';
import {expect} from '@playwright/test';
import type {UserProfile} from '@mattermost/types/users';

import {components} from '@/ui/components';

export default class LoginPage {
    readonly page: Page;

    readonly title;
    readonly subtitle;
    readonly bodyCard;
    readonly loginInput;
    readonly loginPlaceholder;
    readonly loginWithAdLdapPlaceholder;
    readonly samlLoginButton;
    readonly openIdLoginButton;
    readonly passwordInput;
    readonly passwordToggleButton;
    readonly signInButton;
    readonly createAccountLink;
    readonly forgotPasswordLink;
    readonly userErrorLabel;
    readonly fieldWithError;
    readonly formContainer;
    readonly emptyPasswordError;
    readonly invalidCredentialsError;
    readonly errorBanner;
    readonly alreadyAssociatedError;
    readonly userNotRegisteredOnLdapError;
    readonly emailOnlyPlaceholder;
    readonly usernameOnlyPlaceholder;

    readonly header;
    readonly footer;

    constructor(page: Page) {
        this.page = page;

        this.title = page.locator('h1:has-text("Log in to your account")');
        this.subtitle = page.locator('text=Collaborate with your team in real-time');
        this.bodyCard = page.locator('.login-body-card-content');
        this.loginInput = page.locator('#input_loginId');
        this.loginPlaceholder = page.getByPlaceholder('Email or Username');
        this.emailOnlyPlaceholder = page.getByPlaceholder('Email', {exact: true});
        this.usernameOnlyPlaceholder = page.getByPlaceholder('Username', {exact: true});
        this.loginWithAdLdapPlaceholder = page.getByRole('textbox', {name: 'Email, Username or AD/LDAP Username'});
        this.samlLoginButton = page.locator('#saml');
        // Accessible name is the configurable ButtonText, so it isn't stable across tests.
        this.openIdLoginButton = page.locator('#openid');
        this.passwordInput = page.locator('#input_password-input');
        this.passwordToggleButton = page.locator('#password_toggle');
        this.signInButton = page.locator('button:has-text("Log in")');
        this.createAccountLink = page.locator("text=Don't have an account?");
        this.forgotPasswordLink = page.locator('text=Forgot your password?');
        this.userErrorLabel = page.locator('text=Please enter your email or username');
        this.fieldWithError = page.locator('.with-error');
        this.formContainer = page.locator('.signup-team__container');
        this.emptyPasswordError = page.getByText('Please enter your password');
        this.invalidCredentialsError = page.getByText('The email/username or password is invalid.');
        // No accessible role/label - AlertBanner is a plain styled div.
        this.errorBanner = page.locator('.AlertBanner.danger');
        this.alreadyAssociatedError = page.getByText(
            /There is already an account associated with that email address using a sign in method other than/,
        );
        this.userNotRegisteredOnLdapError = page.getByText('User not registered on AD/LDAP server.');

        this.header = new components.MainHeader(page.locator('.hfroute-header'));
        this.footer = new components.Footer(page.locator('.hfroute-footer'));
    }

    async toBeVisible() {
        await this.page.waitForLoadState('networkidle');
        await expect(this.title).toBeVisible();
        await expect(this.loginInput).toBeVisible();
        await expect(this.passwordInput).toBeVisible();
    }

    async goto(url = '/login') {
        await this.page.goto(url);
    }

    async login(user: UserProfile, useUsername = true) {
        await this.loginInput.fill(useUsername ? user.username : user.email);
        await this.passwordInput.fill(user.password);
        await Promise.all([this.page.waitForNavigation(), this.signInButton.click()]);
    }

    async submitCredentials(loginId: string, password: string) {
        await this.loginInput.fill(loginId);
        await this.passwordInput.fill(password);
        await this.signInButton.click();
    }

    async expectNotOnLoginPage() {
        await expect(this.page).not.toHaveURL(/\/login/);
    }

    async expectOnLoginPage() {
        await expect(this.page).toHaveURL(/\/login/);
    }

    oauthLoginButton(name: string) {
        return this.page.getByRole('link', {name});
    }
}
