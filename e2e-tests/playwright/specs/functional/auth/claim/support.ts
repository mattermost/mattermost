// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Page} from '@playwright/test';
import type {Team} from '@mattermost/types/teams';

import {expect, Msg, type App, type PlaywrightExtended, DefaultChannel} from '@mattermost/playwright-lib';

import {expectSignedIn, logIn, openLogin} from '../support';

/**
 * Switching an account's sign-in method on the generated page objects: log in on the login page, open Profile >
 * Security, edit Sign-in Method and follow its switch link to the claim page.
 */

/** Logs in through the login page and opens the team's town square. */
export async function logInToTeam(pw: PlaywrightExtended, page: Page, loginId: string, password: string, team: Team) {
    const app = await openLogin(pw, page);
    await logIn(app, loginId, password);
    await expectSignedIn(page);
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

/**
 * Edits Sign-in Method in Profile > Security and follows its link to switch to `to`. Switching to email needs the
 * method the account is leaving: AD/LDAP opens on the MFA step, OAuth directly on the new-password form.
 */
export async function switchSignInTo(app: App, to: 'openid' | 'ldap'): Promise<void>;
export async function switchSignInTo(app: App, to: 'email', from: 'openid' | 'ldap'): Promise<void>;
export async function switchSignInTo(app: App, to: 'openid' | 'ldap' | 'email', from?: 'openid' | 'ldap') {
    await openSecurity(app);
    const signIn = app.settings.security.section('signin');
    await signIn.editButton.click();
    await expect(signIn.switchTo(to)).toBeVisible();
    await signIn.switchTo(to).click();
    if (to === 'openid') {
        await expect(app.page).toHavePath(`${app.claimPage.pathFor()}/email_to_oauth`);
        await expect(app.claim.emailToOauth.titleText).toHaveText(/Switch Email\/Password Account to .+ SSO/);
        await expect(app.claim.emailToOauth.passwordTextbox).toBeVisible();
    } else if (to === 'ldap') {
        await expect(app.page).toHavePath(`${app.claimPage.pathFor()}/email_to_ldap`);
        await expect(app.claim.emailToLdap.titleText).toHaveMessage(Msg.claim.email_to_ldap.title);
        await expect(app.claim.emailToLdap.passwordTextbox).toBeVisible();
    } else if (from === 'ldap') {
        // LDAP starts on the MFA interstitial, whose title is the shared MFA screen's.
        await expect(app.page).toHavePath(`${app.claimPage.pathFor()}/ldap_to_email`);
        await expect(app.loginMfa.token.container).toBeVisible();
    } else {
        await expect(app.page).toHavePath(`${app.claimPage.pathFor()}/oauth_to_email`);
        await expect(app.claim.oauthToEmail.titleText).toHaveText(/Switch .+ Account to Email/);
        await expect(app.claim.oauthToEmail.passwordTextbox).toBeVisible();
    }
}
