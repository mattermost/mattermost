// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Page} from '@playwright/test';

// Keycloak's own hosted login form (not part of the Mattermost webapp). Its element ids are
// Keycloak's default theme, stable across releases, unlike its (locale-dependent) label text.
export default class KeycloakLoginPage {
    readonly page: Page;

    readonly usernameInput;
    readonly passwordInput;
    readonly signInButton;
    readonly errorMessage;
    readonly accountDisabledMessage;

    constructor(page: Page) {
        this.page = page;

        this.usernameInput = page.locator('#username');
        this.passwordInput = page.locator('#password');
        this.signInButton = page.locator('#kc-login');
        this.errorMessage = page.locator('#input-error');
        this.accountDisabledMessage = page.getByText('Account is disabled, contact your administrator.');
    }

    async login(username: string, password: string) {
        await this.usernameInput.fill(username);
        await this.passwordInput.fill(password);
        await this.signInButton.click();
    }
}
