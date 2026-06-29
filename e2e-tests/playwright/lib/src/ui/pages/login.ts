// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Page} from '@playwright/test';
import {expect} from '@playwright/test';
import type {UserProfile} from '@mattermost/types/users';

import {components} from '@/ui/components';
import en from '@/i18n';
import {duration, wait} from '@/util';

import {BasePage} from '../base_page';
import type {BaseComponent} from '../base_component';

export default class LoginPage extends BasePage {
    readonly components: Record<string, BaseComponent>;

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
    readonly fieldWithError;
    readonly formContainer;

    readonly header;
    readonly footer;

    constructor(page: Page) {
        super(page);

        this.title = page.getByRole('heading', {name: en['login.title'], level: 1});
        this.subtitle = page.getByText(en['login.subtitle']);
        this.bodyCard = page.getByTestId('loginBodyCardContent');
        this.loginInput = page.locator('#input_loginId');
        this.loginPlaceholder = page.getByPlaceholder(
            `${en['login.email']}${en['login.placeholderOr']}${en['login.username']}`,
        );
        this.loginWithAdLdapPlaceholder = page.getByPlaceholder(
            `${en['login.email']}, ${en['login.username']}${en['login.placeholderOr']}${en['login.ldapUsername']}`,
        );
        this.passwordInput = page.locator('#input_password-input');
        this.passwordToggleButton = page.locator('#password_toggle');
        this.signInButton = page.getByRole('button', {name: en['login.logIn']});
        this.createAccountLink = page.getByRole('link', {name: en['login.noAccount']});
        this.forgotPasswordLink = page.getByRole('link', {name: en['login.forgot']});
        this.userErrorLabel = page.getByText(en['login.noEmailUsername']);
        this.fieldWithError = page.locator('[data-has-error="true"]');
        this.formContainer = page.getByTestId('loginBodyCardContent');

        this.header = new components.MainHeader(page.getByTestId('hfrouteHeader'));
        this.footer = new components.Footer(page.getByTestId('hfrouteFooter'));

        this.components = {header: this.header, footer: this.footer};
    }

    async toBeVisible() {
        await this.page.waitForLoadState('networkidle');
        await this.page.waitForLoadState('domcontentloaded');
        await wait(duration.half_sec);
        await expect(this.title).toBeVisible();
        await expect(this.loginInput).toBeVisible();
        await expect(this.passwordInput).toBeVisible();
    }

    async goto() {
        await this.page.goto('/login', {waitUntil: 'networkidle'});
    }

    async login(user: UserProfile, useUsername = true) {
        await this.loginInput.fill(useUsername ? user.username : user.email);
        await this.passwordInput.fill(user.password);
        await Promise.all([this.page.waitForNavigation(), this.signInButton.click()]);
    }
}
