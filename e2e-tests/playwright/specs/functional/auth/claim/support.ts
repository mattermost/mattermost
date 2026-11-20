// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Page} from '@playwright/test';
import type {Team} from '@mattermost/types/teams';

import {expect, type App, type PlaywrightExtended, DefaultChannel} from '@mattermost/playwright-lib';

import {logIn, openLogin} from '../support';

/**
 * Switching an account's sign-in method on the generated page objects: log in on the login page, open Profile >
 * Security, edit Sign-in Method and follow its switch link to the claim page.
 */

/** Logs in through the login page and opens the team's town square. */
export async function logInToTeam(pw: PlaywrightExtended, page: Page, loginId: string, password: string, team: Team) {
    const app = await openLogin(pw, page);
    await logIn(app, loginId, password);
    await expect(page).not.toHaveURL(/\/login/);
    await app.channelsPage.goto({team, channel: DefaultChannel.TownSquare});
    return app;
}

/** Opens Profile > Security. */
export async function openSecurity(app: App) {
    await app.globalHeader.openAccountMenuButton.clickTo(app.globalHeader.accountMenu.profileMenuItem);
    await app.globalHeader.accountMenu.profileMenuItem.clickTo(app.userSettingsModal);
    await app.userSettingsModal.tabs.tab('security').select();
    await expect(app.settings.security.section('signin')).toBeVisible();
}

/** Edits Sign-in Method in Profile > Security and follows its link to switch to `to`. */
export async function switchSignInTo(
    app: App,
    to: Parameters<ReturnType<App['settings']['security']['section']>['switchTo']>[0],
) {
    await openSecurity(app);
    await app.settings.security.section('signin').editButton.click();
    await expect(app.settings.security.section('signin').switchTo(to)).toBeVisible();
    await app.settings.security.section('signin').switchTo(to).click();
    await expect(app.page).toHaveURL(/\/claim\//);
    // Claim titles have no generated part; ClaimController's #claim contains each form and its MFA replacement.
    if (to === 'openid') {
        // The heading and the generated password field share this untagged route container, which is the page's only #claim.
        const claim = app.page.locator('#claim');
        await expect(claim.getByRole('heading', {name: /Switch Email\/Password Account to .+ SSO/})).toBeVisible();
        await expect(app.claim.emailToOauth.passwordTextbox).toBeVisible();
    } else if (to === 'ldap') {
        // The heading and the generated LDAP password field share this untagged route container, which is the page's only #claim.
        const claim = app.page.locator('#claim');
        await expect(
            claim.getByRole('heading', {name: 'Switch Email/Password Account to AD/LDAP', exact: true}),
        ).toBeVisible();
        await expect(app.claim.emailToLdap.passwordTextbox).toBeVisible();
    } else if (to === 'email') {
        // The untagged route container owns the title; the form beneath it is asserted next.
        await expect(
            app.page.locator('#claim').getByRole('heading', {name: /Switch .+ Account to Email/}),
        ).toBeVisible();
        // LDAP starts on the MFA interstitial; OAuth directly shows the new-password form.
        await expect(
            app.claim.oauthToEmail.passwordTextbox.locator
                .or(app.claim.ldapToEmail.ldapPasswordTextbox.locator)
                .or(app.loginMfa.token.container.locator)
                .first(),
        ).toBeVisible();
    }
}
