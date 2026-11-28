// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Page} from '@playwright/test';

import {App, expect, Msg, openSignedOut, testConfig, type PlaywrightExtended} from '@mattermost/playwright-lib';

export {expectSignedIn, logIn, logInWithKeycloak, openLogin} from '@mattermost/playwright-lib';

export async function expectOnLoginPage(page: Page): Promise<void> {
    const app = new App(page);
    await expect(page).toHavePath(app.loginPage.pathFor());
    await expect(app.login.card.container).toBeVisible();
}

export async function expectLoginRedirectFrom(page: Page, path: string): Promise<void> {
    await openSignedOut(page, path);
    await expectOnLoginPage(page);
}

export async function openSignup(
    pw: PlaywrightExtended,
    page: Page,
    search = '',
    {form = true}: {form?: boolean} = {},
): Promise<App> {
    await pw.hasSeenLandingPage();
    const app = new App(page);
    await page.goto(app.signupPage.pathFor() + search);
    if (form) {
        await expect(app.signup.titleText).toHaveRole('heading');
        await expect(app.signup.titleText).toHaveMessage(Msg.signup_user_completed.title);
        await expect(app.signup.card.email.container).toBeVisible();
        await expect(app.signup.card.username.container).toBeVisible();
        await expect(app.signup.card.password.container).toBeVisible();
    } else {
        // Email signup can be disabled while external methods remain: the card still renders its title.
        await expect(app.signup.card.titleText).toBeVisible();
    }
    return app;
}

/** Submits signup and observes its actual redirect or field/server rejection, leaving exact content to the caller. */
export async function signUp(app: App, user: {email: string; username: string; password: string}): Promise<void> {
    const card = app.signup.card;
    await card.email.container.fill(user.email);
    await expect(card.email.container).toHaveValue(user.email);
    await card.username.container.fill(user.username);
    await expect(card.username.container).toHaveValue(user.username);
    await card.password.container.fill(user.password);
    await expect(card.password.container).toHaveValue(user.password);
    await card.termsCheckbox.set(true);
    await expect(card.termsCheckbox).toBeChecked();
    const signupPath = testConfig.withSubpath(app.signupPage.pathFor());
    await card.createAccountButton.click();
    await expect
        .poll(
            async () =>
                new URL(app.page.url()).pathname !== signupPath ||
                (await app.signup.banner.container.isVisible()) ||
                (await card.email.validationAlert.isVisible()) ||
                (await card.username.validationAlert.isVisible()) ||
                card.password.validationAlert.isVisible(),
        )
        .toBe(true);
}

export async function expectOnSelectTeam(page: Page): Promise<void> {
    const app = new App(page);
    await expect(page).toHavePath(app.selectTeamPage.pathFor());
    const title = app.selectTeam.titleText;
    await expect(title).toBeVisible();
    await expect(title).toHaveRole('heading');
    await expect(title).toHaveAccessibleName('Teams you can join:');
}

/** The complete server rejection for an email domain outside the allow list. */
export const DOMAIN_NOT_ALLOWED =
    'The email you provided does not belong to an accepted domain. Please contact your administrator or sign up with a different email.';

export async function openAdminConsole(app: App, path: string): Promise<void> {
    await app.page.goto(app.adminConsolePage.pathFor() + path);
    await expect(app.admin.saveButton).toBeVisible();
    if (path === '/authentication/password') {
        await expect(app.admin.setting('passwordMinimumLength').valueTextbox).toBeVisible();
    } else if (path === '/site_config/public_links') {
        await expect(app.admin.setting('FileSettings.PublicLinkSalt').regenerateButton).toBeVisible();
    } else if (path === '/authentication/mfa') {
        await expect(app.admin.header).toContainText('Multi-factor Authentication');
    }
}
