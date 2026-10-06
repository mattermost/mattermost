// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Page} from '@playwright/test';

import {KEYCLOAK_REALM} from '@/containers/constants';
import {testConfig} from '@/test_config';
import {duration} from '@/util';

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

    // OIDC logout without id_token_hint may only show a confirm page; clear cookies either way.
    async logout() {
        await this.page.goto(`${testConfig.keycloakUrl}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/logout`, {
            waitUntil: 'domcontentloaded',
        });
        const confirmLogout = this.page.locator('#kc-logout');
        await confirmLogout.click({timeout: 5000}).catch(() => undefined);
        await this.page.context().clearCookies();
    }

    /**
     * Completes Keycloak login when the hosted form is shown, or no-ops if the
     * IdP session is reused and the browser never lands on Keycloak.
     */
    async loginIfFormShown(username: string, password: string) {
        try {
            await this.usernameInput.waitFor({state: 'visible', timeout: duration.ten_sec});
        } catch {
            // IdP session reused; the browser never landed on Keycloak.
            return;
        }
        await this.login(username, password);
    }
}
