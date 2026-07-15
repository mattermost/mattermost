// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Page} from '@playwright/test';
import {expect} from '@playwright/test';

import type {KeycloakUser} from '@/server/keycloak';
import {duration} from '@/util';

/**
 * Keycloak identity-provider actions used to enter Mattermost through SAML.
 */
export default class KeycloakLoginPage {
    readonly page: Page;

    constructor(page: Page) {
        this.page = page;
    }

    async login(user: KeycloakUser, waitForMattermost = true) {
        await this.page.goto('about:blank');
        await this.page.context().clearCookies();
        await this.page.goto('/login/sso/saml');
        await this.submit(user, waitForMattermost);
    }

    async submit(user: KeycloakUser, waitForMattermost = true) {
        await expect(this.page.getByLabel('Username or email', {exact: true})).toBeVisible({
            timeout: duration.half_min,
        });
        await this.page.getByLabel('Username or email', {exact: true}).fill(user.email);
        await this.page.getByLabel('Password', {exact: true}).fill(user.password);
        const keycloakOrigin = new URL(this.page.url()).origin;
        await this.page.getByRole('button', {name: /Log In|Sign In/i}).click();
        if (waitForMattermost) {
            await this.page.waitForURL((url) => url.origin !== keycloakOrigin, {timeout: duration.half_min});
            await this.page.waitForLoadState('domcontentloaded');
        }
    }

    async assertAccountDisabled() {
        await expect(
            this.page.getByText('Account is disabled, contact your administrator.', {exact: true}),
        ).toBeVisible({
            timeout: duration.half_min,
        });
    }
}
