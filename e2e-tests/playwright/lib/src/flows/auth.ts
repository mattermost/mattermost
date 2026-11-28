// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Page} from '@playwright/test';

import {expect, settle} from '../aria';
import {testConfig} from '../test_config';
import {Api, App, LoginPage} from '../ui/generated';
import type KeycloakLoginPage from '../ui/pages/keycloak_login';

/** What the auth flows need from `pw`: the landing-page flag and Keycloak's hosted form. */
type AuthFixture = {
    hasSeenLandingPage: (url?: string) => Promise<unknown>;
    keycloakLoginPage: KeycloakLoginPage;
};

const onServer = (url: URL): boolean => url.origin === new URL(testConfig.baseURL).origin;
const loginPath = (): string => testConfig.withSubpath(LoginPage.path());

/** Back on Mattermost and past its login route, including redirects whose exact outcome the caller checks. */
export const signedInUrl = (url: URL): boolean => onServer(url) && !url.pathname.startsWith(loginPath());

/** On Mattermost's login page, rather than Keycloak's `/login-actions/…` route. */
export const loginPageUrl = (url: URL): boolean => onServer(url) && url.pathname === loginPath();

/** Signed in: the page is back on Mattermost and past its login route. A page of another site, such as Keycloak's, does not count. */
export async function expectSignedIn(page: Page): Promise<void> {
    await expect(page).toHaveURL(signedInUrl);
}

/** The login body heading is visible with its exact accessible name. */
export async function expectLoginHeading(app: Pick<App, 'page'>): Promise<void> {
    const card = new App(app.page).login.card;
    // The untagged heading is outside the card; its third parent is the body-content containing both.
    await expect(
        card.locator.locator('../../..').getByRole('heading', {name: 'Log in to your account', exact: true}),
    ).toBeVisible();
}

export async function openLogin(
    pw: Pick<AuthFixture, 'hasSeenLandingPage'>,
    page: Page,
    {credentials = true}: {credentials?: boolean} = {},
): Promise<App> {
    await pw.hasSeenLandingPage();
    const app = new App(page);
    await app.loginPage.goto();
    // SSO-only configurations still render the login card, while omitting the credential inputs.
    await expect(app.login.card.container).toBeVisible();
    if (credentials) {
        await expectLoginHeading(app);
        await expect(app.login.loginId.container).toBeVisible();
        await expect(app.login.password.container).toBeVisible();
    }
    return app;
}

/** The caller names an expected rejection's HTTP status and keeps its specific error/MFA assertions. */
export async function logIn(
    app: App,
    loginId: string,
    password: string,
    {status = 200}: {status?: number} = {},
): Promise<void> {
    await app.login.loginId.container.fill(loginId);
    await expect(app.login.loginId.container).toHaveValue(loginId);
    await app.login.password.container.fill(password);
    await expect(app.login.password.container).toHaveValue(password);
    await settle(app.login.card.logInButton, {wait: Api.Login, status}).click();
}

/** Follows SAML/OpenID to Keycloak, allowing both server rejection and IdP rejection outcomes. */
export async function logInWithKeycloak(
    pw: AuthFixture,
    page: Page,
    service: 'saml' | 'openid',
    user: {username: string; password: string},
    {ifFormShown = false} = {},
): Promise<App> {
    const app = await openLogin(pw, page);
    await app.login.external(service).click();

    // Keycloak owns this hosted form outside the webapp; its existing native form locator is the actual destination.
    if (ifFormShown) {
        await expect
            .poll(
                async () => (await pw.keycloakLoginPage.usernameInput.isVisible()) || signedInUrl(new URL(page.url())),
            )
            .toBe(true);
        await pw.keycloakLoginPage.loginIfFormShown(user.username, user.password);
    } else {
        await expect(pw.keycloakLoginPage.usernameInput).toBeVisible();
        await pw.keycloakLoginPage.login(user.username, user.password);
    }

    // These are the source/caller outcomes: a callback back to Mattermost (including its error page), or an IdP error.
    await expect
        .poll(
            async () =>
                signedInUrl(new URL(page.url())) ||
                (await app.login.banner.container.isVisible()) ||
                (await pw.keycloakLoginPage.errorMessage.isVisible()) ||
                pw.keycloakLoginPage.accountDisabledMessage.isVisible(),
        )
        .toBe(true);
    return app;
}

/** Opens a protected path without swallowing navigation errors unrelated to an app redirect. */
export async function openSignedOut(page: Page, path: string): Promise<void> {
    await page
        .goto(path.startsWith('/') ? testConfig.withSubpath(path) : path, {waitUntil: 'commit'})
        .catch((error: unknown) => {
            if (!/interrupted|ERR_ABORTED/i.test(String(error))) {
                throw error;
            }
        });
}
