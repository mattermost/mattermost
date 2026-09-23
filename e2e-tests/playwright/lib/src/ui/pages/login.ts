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
        this.loginPlaceholder = page.getByRole('textbox', {name: 'Email or Username'});
        this.emailOnlyPlaceholder = page.getByRole('textbox', {name: 'Email', exact: true});
        this.usernameOnlyPlaceholder = page.getByRole('textbox', {name: 'Username', exact: true});
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
        this.invalidCredentialsError = page.getByText(
            /The email\/username or password is invalid\.|Enter a valid email or username and\/or password/,
        );
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

    async expectLoginRedirectFrom(path: string) {
        try {
            await this.page.goto(path, {waitUntil: 'commit'});
        } catch (error) {
            const message = String(error);
            if (!/interrupted|ERR_ABORTED/i.test(message)) {
                throw error;
            }
        }
        await this.expectOnLoginPage();
    }

    oauthLoginButton(name: string) {
        return this.page.getByRole('link', {name});
    }

    async expectOAuthLogin(name: string, path: string, color?: string) {
        const button = this.oauthLoginButton(name);
        await expect(button).toBeVisible();
        // Buttons use absolute site URLs (e.g. http://localhost:8055/oauth/google/login).
        await expect(async () => {
            const href = await button.getAttribute('href');
            expect(href).toBeTruthy();
            const url = new URL(href!, this.page.url());
            expect(url.origin).toBe(new URL(this.page.url()).origin);
            expect(url.pathname).toBe(path);
            expect(['', '?extra=expired']).toContain(url.search);
        }).toPass();
        if (color) {
            const rgb = hexToRgb(color);
            await expect(button).toHaveCSS('color', rgb);
            await expect(button).toHaveCSS('border-color', rgb);
        }
    }
}

function hexToRgb(hex: string): string {
    const n = hex.replace('#', '');
    const r = parseInt(n.slice(0, 2), 16);
    const g = parseInt(n.slice(2, 4), 16);
    const b = parseInt(n.slice(4, 6), 16);
    return `rgb(${r}, ${g}, ${b})`;
}
