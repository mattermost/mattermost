// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify a user who only exists in Keycloak is provisioned via OpenID SSO on first
 * login and can reach a team channel once granted membership.
 *
 * @precondition
 * A Keycloak realm with the mattermost-openid client, reachable at OpenIdSettings endpoints.
 */
test('logs in a directory-only user through Keycloak OpenID SSO', {tag: '@openid'}, async ({pw}) => {
    await pw.ensureLicense();
    await pw.skipIfNoLicense();
    await pw.ensureKeycloakOpenId();
    await pw.ensureSiteUrl();

    const {adminClient} = await pw.getAdminClient();
    const team = await pw.createNewTeam(adminClient);
    const keycloakUser = pw.generateKeycloakUser('openiduser');
    await pw.createKeycloakUser(keycloakUser);

    // # Log in through the OpenID SSO button
    await pw.hasSeenLandingPage();
    await pw.loginPage.goto();
    await pw.loginPage.toBeVisible();
    await expect(pw.loginPage.openIdLoginButton).toBeVisible();
    await pw.loginPage.openIdLoginButton.click();
    await pw.keycloakLoginPage.login(keycloakUser.username, keycloakUser.password);

    // * Verify the server provisioned the account via OpenID
    await pw.loginPage.expectNotOnLoginPage();
    const provisionedUser = await adminClient.getUserByUsername(keycloakUser.username);
    expect(provisionedUser.auth_service).toBe('openid');
    expect(provisionedUser.email).toBe(keycloakUser.email);

    // # Grant team membership and open a channel
    await adminClient.addToTeam(team.id, provisionedUser.id);
    await pw.channelsPage.goto(team.name);

    // * Verify the user lands on a real channel
    await pw.channelsPage.toBeVisible();
});

/**
 * @objective Verify an OpenID login is rejected when a basic-auth account already owns the email.
 *
 * @precondition
 * A Keycloak realm with the mattermost-openid client, reachable at OpenIdSettings endpoints.
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

        // # Create a basic-auth account with the same email
        await adminClient.createUser(
            {
                email: keycloakUser.email,
                username: `mmuser${keycloakUser.username}`,
                password: pw.newTestPassword(),
            } as never,
            '',
            '',
        );

        // # Attempt OpenID login for that email
        await pw.hasSeenLandingPage();
        await pw.loginPage.goto();
        await pw.loginPage.toBeVisible();
        await pw.loginPage.openIdLoginButton.click();
        await pw.keycloakLoginPage.login(keycloakUser.username, keycloakUser.password);

        // * Verify the login is rejected rather than linked
        await expect(pw.loginPage.alreadyAssociatedError).toBeVisible();
    },
);

/**
 * @objective Verify logging out after an OpenID login clears the Mattermost session.
 *
 * @precondition
 * A Keycloak realm with the mattermost-openid client, reachable at OpenIdSettings endpoints.
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

    // # Log in through OpenID and open the team's channel
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

    // * Verify the session is cleared
    await pw.loginPage.expectOnLoginPage();

    // * Verify revisiting the team's channel redirects back to login
    await pw.loginPage.goto(`/${team.name}`);
    await pw.loginPage.expectOnLoginPage();
});
