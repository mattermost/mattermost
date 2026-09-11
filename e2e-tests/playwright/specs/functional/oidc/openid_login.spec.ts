// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify a user who only exists in Keycloak (never created in Mattermost) can
 * authenticate through generic OpenID Connect SSO once OpenID authentication is enabled, that
 * the server provisions their account via OpenID on first login rather than local auth, and that
 * they can reach a real channel once they have team membership.
 *
 * @precondition
 * A Keycloak realm reachable at the configured OpenIdSettings endpoints, with an OIDC client
 * matching OpenIdSettings.Id.
 */
test('logs in a directory-only user through Keycloak OpenID SSO', {tag: '@openid'}, async ({pw}) => {
    // Ensure prerequisites
    await pw.ensureLicense();
    await pw.skipIfNoLicense();
    await pw.ensureKeycloakOpenId();
    // OAuth's completion step recomputes redirect_uri from the request's own Host header, which
    // must match the value baked into the authorization request (built from
    // ServiceSettings.SiteURL) - so SiteURL needs to be host-reachable for the browser to
    // complete the round trip at all.
    await pw.ensureSiteUrl();

    const {adminClient} = await pw.getAdminClient();
    // A directory-only user has no team until one is granted after they're provisioned below.
    const team = await pw.createNewTeam(adminClient);

    const keycloakUser = pw.generateKeycloakUser('openiduser');
    await pw.createKeycloakUser(keycloakUser);

    // # Log in through the OpenID SSO button, which redirects to Keycloak's hosted login form
    await pw.hasSeenLandingPage();
    await pw.loginPage.goto();
    await pw.loginPage.toBeVisible();

    // * Verify the login form reflects OpenID being enabled
    await expect(pw.loginPage.openIdLoginButton).toBeVisible();
    await pw.loginPage.openIdLoginButton.click();

    // Keycloak's own hosted login form
    await pw.keycloakLoginPage.login(keycloakUser.username, keycloakUser.password);

    // * Verify the login succeeded
    await expect(pw.loginPage.page).not.toHaveURL(/\/login/);

    // * Verify the server provisioned the account via OpenID, with Keycloak's attributes
    const provisionedUser = await adminClient.getUserByUsername(keycloakUser.username);
    expect(provisionedUser.auth_service).toBe('openid');
    expect(provisionedUser.email).toBe(keycloakUser.email);

    // # Grant team membership (the OpenID user had none) and reach its channel
    await adminClient.addToTeam(team.id, provisionedUser.id);
    await pw.channelsPage.goto(team.name);

    // * Verify the user lands on a real channel, not stuck on team selection
    await pw.channelsPage.toBeVisible();
});

/**
 * @objective Verify an OpenID login attempt is rejected, rather than silently linked, when a
 * Mattermost account with the same email already exists on basic email/password auth.
 *
 * @precondition
 * A Keycloak realm reachable at the configured OpenIdSettings endpoints, with an OIDC client
 * matching OpenIdSettings.Id.
 */
test(
    'OpenID login is rejected when the email already belongs to a basic-auth account',
    {tag: '@openid'},
    async ({pw}) => {
        await pw.ensureLicense();
        await pw.skipIfNoLicense();
        await pw.ensureKeycloakOpenId();
        await pw.ensureSiteUrl();

        const {adminClient} = await pw.getAdminClient();
        const keycloakUser = pw.generateKeycloakUser('openidconflict');
        await pw.createKeycloakUser(keycloakUser);

        // # Create a basic-auth Mattermost account with the same email as the Keycloak user
        await adminClient.createUser(
            {
                email: keycloakUser.email,
                username: `mmuser${keycloakUser.username}`,
                password: pw.newTestPassword(),
            } as never,
            '',
            '',
        );

        // # Attempt to log in as that email through OpenID SSO
        await pw.hasSeenLandingPage();
        await pw.loginPage.goto();
        await pw.loginPage.toBeVisible();
        await pw.loginPage.openIdLoginButton.click();
        await pw.keycloakLoginPage.login(keycloakUser.username, keycloakUser.password);

        // * Verify the server redirects to its error page rather than creating a session
        await expect(
            pw.loginPage.page.getByText(
                'There is already an account associated with that email address using a sign in method other than openid. Please sign in using email.',
            ),
        ).toBeVisible();
    },
);

/**
 * @objective Verify a wrong password on Keycloak's hosted login page keeps the user there with
 * an error, and never creates a Mattermost session or account.
 *
 * @precondition
 * A Keycloak realm reachable at the configured OpenIdSettings endpoints, with an OIDC client
 * matching OpenIdSettings.Id.
 */
test('login fails gracefully with wrong Keycloak credentials', {tag: '@openid'}, async ({pw}) => {
    await pw.ensureLicense();
    await pw.skipIfNoLicense();
    await pw.ensureKeycloakOpenId();
    await pw.ensureSiteUrl();

    const {adminClient} = await pw.getAdminClient();
    const keycloakUser = pw.generateKeycloakUser('openidbad');
    await pw.createKeycloakUser(keycloakUser);

    // # Click the OpenID button, then submit the wrong password on Keycloak's form
    await pw.hasSeenLandingPage();
    await pw.loginPage.goto();
    await pw.loginPage.toBeVisible();
    await pw.loginPage.openIdLoginButton.click();
    await pw.keycloakLoginPage.login(keycloakUser.username, 'WrongPassword1');

    // * Verify Keycloak rejects it and keeps the user on its own login page
    await expect(pw.keycloakLoginPage.errorMessage).toBeVisible();
    await expect(pw.keycloakLoginPage.usernameInput).toBeVisible();

    // * Verify no Mattermost account was created
    await expect(adminClient.getUserByUsername(keycloakUser.username)).rejects.toThrow();
});

/**
 * @objective Verify a Keycloak user suspended via the admin API (`enabled: false`) cannot
 * authenticate through OpenID SSO, and no Mattermost session is created.
 *
 * @precondition
 * A Keycloak realm reachable at the configured OpenIdSettings endpoints, with an OIDC client
 * matching OpenIdSettings.Id.
 */
test('suspended Keycloak user cannot log in via OpenID', {tag: '@openid'}, async ({pw}) => {
    await pw.ensureLicense();
    await pw.skipIfNoLicense();
    await pw.ensureKeycloakOpenId();
    await pw.ensureSiteUrl();

    const {adminClient} = await pw.getAdminClient();
    const keycloakUser = pw.generateKeycloakUser('openidsuspended');
    const keycloakUserId = await pw.createKeycloakUser(keycloakUser);
    await pw.suspendKeycloakUser(keycloakUserId);

    // # Click the OpenID button, then submit valid credentials for the now-suspended user
    await pw.hasSeenLandingPage();
    await pw.loginPage.goto();
    await pw.loginPage.toBeVisible();
    await pw.loginPage.openIdLoginButton.click();
    await pw.keycloakLoginPage.login(keycloakUser.username, keycloakUser.password);

    // * Verify Keycloak rejects the login and keeps the user on its own login page
    await expect(pw.keycloakLoginPage.accountDisabledMessage).toBeVisible();

    // * Verify no Mattermost account was created
    await expect(adminClient.getUserByUsername(keycloakUser.username)).rejects.toThrow();
});

/**
 * @objective Verify logging out after an OpenID login clears the Mattermost session, so a
 * revisit to a team channel redirects back to the login page. Generic OpenID has no IdP-side
 * single logout, so this only covers the local session.
 *
 * @precondition
 * A Keycloak realm reachable at the configured OpenIdSettings endpoints, with an OIDC client
 * matching OpenIdSettings.Id.
 */
test('logout invalidates a session created via OpenID', {tag: '@openid'}, async ({pw}) => {
    await pw.ensureLicense();
    await pw.skipIfNoLicense();
    await pw.ensureKeycloakOpenId();
    await pw.ensureSiteUrl();

    const {adminClient} = await pw.getAdminClient();
    const team = await pw.createNewTeam(adminClient);
    const keycloakUser = pw.generateKeycloakUser('openidlogout');
    await pw.createKeycloakUser(keycloakUser);

    // # Log in through OpenID and reach the team's channel
    await pw.hasSeenLandingPage();
    await pw.loginPage.goto();
    await pw.loginPage.toBeVisible();
    await pw.loginPage.openIdLoginButton.click();
    await pw.keycloakLoginPage.login(keycloakUser.username, keycloakUser.password);

    const provisionedUser = await adminClient.getUserByUsername(keycloakUser.username);
    await adminClient.addToTeam(team.id, provisionedUser.id);
    await pw.channelsPage.goto(team.name);
    await pw.channelsPage.toBeVisible();

    // # Log out via the user account menu
    await pw.channelsPage.logout();

    // * Verify the session is cleared, landing back on the login page
    await expect(pw.loginPage.page).toHaveURL(/\/login/);

    // * Verify revisiting the team's channel redirects back to login rather than re-entering it
    await pw.channelsPage.goto(team.name);
    await expect(pw.loginPage.page).toHaveURL(/\/login/);
});

/**
 * @objective Verify the OpenID login button's visibility follows OpenIdSettings.Enable.
 *
 * @precondition
 * A Keycloak realm reachable at the configured OpenIdSettings endpoints, with an OIDC client
 * matching OpenIdSettings.Id.
 */
test('OpenID button visibility follows config', {tag: '@openid'}, async ({pw}) => {
    await pw.ensureLicense();
    await pw.skipIfNoLicense();

    const {adminClient} = await pw.getAdminClient();
    await pw.hasSeenLandingPage();

    // # Disable OpenID and load the login page
    await adminClient.patchConfig({OpenIdSettings: {Enable: false}});
    await pw.loginPage.goto();
    await pw.loginPage.toBeVisible();

    // * Verify the button is hidden
    await expect(pw.loginPage.openIdLoginButton).toBeHidden();

    // # Enable OpenID and reload
    await pw.ensureKeycloakOpenId();
    await pw.loginPage.goto();
    await pw.loginPage.toBeVisible();

    // * Verify the button is visible
    await expect(pw.loginPage.openIdLoginButton).toBeVisible();
});
