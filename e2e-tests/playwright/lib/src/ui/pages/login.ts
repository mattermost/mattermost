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

        this.title = page.getByRole('heading', {name: 'Log in to your account'});
        this.subtitle = page.getByText('Collaborate with your team in real-time');
        this.bodyCard = page.getByTestId('login-body-card');
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
        this.signInButton = page.getByRole('button', {name: 'Log in'});
        this.createAccountLink = page.getByRole('link', {name: "Don't have an account?"});
        this.forgotPasswordLink = page.getByText('Forgot your password?');
        this.userErrorLabel = page.getByText('Please enter your email or username');
        this.emptyPasswordError = page.getByText('Please enter your password');
        this.invalidCredentialsError = page.getByText('The email/username or password is invalid.');
        // No accessible role/label - AlertBanner is a plain styled div.
        this.errorBanner = page.locator('.AlertBanner.danger');
        this.alreadyAssociatedError = page.getByText(
            /There is already an account associated with that email address using a sign in method other than/,
        );
        this.userNotRegisteredOnLdapError = page.getByText('User not registered on AD/LDAP server.');

        this.header = new components.MainHeader(page.getByTestId('hfroute-header'));
        this.footer = new components.Footer(page.getByTestId('hfroute-footer'));
    }

    async toBeVisible() {
        await this.page.waitForLoadState('networkidle');
        await expect(this.title).toBeVisible();
        await expect(this.loginInput).toBeVisible();
        await expect(this.passwordInput).toBeVisible();
    }

    async goto(url = '/login') {
        await this.page.goto(url, {waitUntil: 'domcontentloaded'});
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
