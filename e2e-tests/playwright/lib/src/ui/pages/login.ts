// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Page} from '@playwright/test';
import {expect} from '@playwright/test';
import type {UserProfile} from '@mattermost/types/users';

import {components} from '@/ui/components';
import {duration} from '@/util';

export default class LoginPage {
    readonly page: Page;

    readonly title;
    readonly subtitle;
    readonly bodyCard;
    readonly loginInput;
    readonly loginPlaceholder;
    readonly loginWithAdLdapPlaceholder;
    readonly passwordInput;
    readonly passwordToggleButton;
    readonly signInButton;
    readonly createAccountLink;
    readonly forgotPasswordLink;
    readonly userErrorLabel;
    readonly loginRejectionMessage;

    readonly header;
    readonly footer;

    constructor(page: Page) {
        this.page = page;

        this.title = page.getByRole('heading', {name: 'Log in to your account'});
        this.subtitle = page.getByText('Collaborate with your team in real-time');
        this.bodyCard = page.getByTestId('login-body-card');
        this.loginInput = page.getByRole('textbox', {name: /Email|Username|AD\/LDAP Username/});
        this.loginPlaceholder = page.getByPlaceholder('Email or Username');
        this.loginWithAdLdapPlaceholder = page.getByPlaceholder('Email, Username or AD/LDAP Username');
        this.passwordInput = page.getByRole('textbox', {name: 'Password', exact: true});
        this.passwordToggleButton = page.getByRole('button', {name: /password/i});
        this.signInButton = page.getByRole('button', {name: 'Log in'});
        this.createAccountLink = page.getByRole('link', {name: "Don't have an account?"});
        this.forgotPasswordLink = page.getByText('Forgot your password?');
        this.userErrorLabel = page.getByText('Please enter your email or username');
        this.loginRejectionMessage = page.getByText(
            /^(?:We couldn't find an account matching your login credentials\.|Your password is incorrect\.|The email\/username or password is invalid\.|Enter a valid (?:email(?: or username)?|username) and\/or password(?:, or sign in using another method)?\.?)$/,
        );

        this.header = new components.MainHeader(page.getByTestId('hfroute-header'));
        this.footer = new components.Footer(page.getByTestId('hfroute-footer'));
    }

    async toBeVisible() {
        await this.page.waitForLoadState('networkidle');
        await expect(this.title).toBeVisible();
        await expect(this.loginInput).toBeVisible();
        await expect(this.passwordInput).toBeVisible();
    }

    async goto() {
        await this.page.goto('/login');
        const viewInBrowser = this.page.getByRole('link', {name: 'View in Browser'});
        if (await viewInBrowser.isVisible()) {
            await this.page.getByRole('checkbox', {name: 'Remember my preference'}).check();
            await viewInBrowser.click();
        }
    }

    async login(user: UserProfile, useUsername = true) {
        await this.loginInput.fill(useUsername ? user.username : user.email);
        await this.passwordInput.fill(user.password);
        await Promise.all([this.page.waitForNavigation(), this.signInButton.click()]);
    }

    async loginWithLdap(username: string, password: string) {
        await this.loginInput.fill(username);
        await this.passwordInput.fill(password);
        await this.signInButton.click();
    }

    async toHaveError(message: string) {
        await expect(this.page.getByText(message, {exact: true})).toBeVisible({timeout: duration.half_min});
    }
}
