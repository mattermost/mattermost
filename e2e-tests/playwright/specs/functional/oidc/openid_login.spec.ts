// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    Api,
    DefaultChannel,
    expect,
    expectSignedIn,
    logInWithKeycloak,
    openSignedOut,
    settle,
    test,
    testConfig,
} from '@mattermost/playwright-lib';

/**
 * @objective Verify a user who only exists in Keycloak is provisioned via OpenID SSO on first
 * login and can reach a team channel once granted membership.
 *
 * @precondition
 * A Keycloak realm with the mattermost-openid client, reachable at OpenIdSettings endpoints.
 */
test('logs in a directory-only user through Keycloak OpenID SSO', {tag: '@openid'}, async ({pw, page}) => {
    await pw.ensureLicense();
    await pw.skipIfNoLicense();
    await pw.ensureKeycloakOpenId();
    await pw.ensureSiteUrl();

    const {adminClient} = await pw.getAdminClient();
    const team = await pw.createNewTeam(adminClient);
    const keycloakUser = pw.generateKeycloakUser('openiduser');
    await pw.createKeycloakUser(keycloakUser);

    // # Log in through the OpenID SSO button
    const app = await logInWithKeycloak(pw, page, 'openid', keycloakUser);

    // * Verify the server provisioned the account via OpenID
    await expectSignedIn(page);
    const provisionedUser = await adminClient.getUserByUsername(keycloakUser.username);
    expect(provisionedUser.auth_service).toBe('openid');
    expect(provisionedUser.email).toBe(keycloakUser.email);

    // # Grant team membership and open a channel
    await adminClient.addToTeam(team.id, provisionedUser.id);
    await app.channelsPage.goto({team, channel: DefaultChannel.TownSquare});

    // * Verify the user lands on a real channel
    await expect(app.center.postCreate.message.container).toBeVisible();
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
    async ({pw, page}) => {
        test.skip(
            testConfig.subpathMode,
            'Known product bug: the server signs the error page URL with the subpath but the webapp verifies it without, so the error message is never shown under a subpath.',
        );

        await pw.ensureLicense();
        await pw.skipIfNoLicense();
        await pw.ensureKeycloakOpenId();
        await pw.ensureSiteUrl();

        const {adminClient} = await pw.getAdminClient();
        const keycloakUser = pw.generateKeycloakUser('openidconflict');
        await pw.createKeycloakUser(keycloakUser);

        // # Create a basic-auth account with the same email
        const existing = await adminClient.createUser(
            {
                email: keycloakUser.email,
                username: `mmuser${keycloakUser.username}`,
                password: pw.newTestPassword(),
            } as never,
            '',
            '',
        );

        // # Attempt OpenID login for that email
        const app = await logInWithKeycloak(pw, page, 'openid', keycloakUser);

        // * Verify the login is rejected rather than linked: the error page names the other sign-in method
        await expect(app.errorView.messageText).toBeVisible();
        await expect(app.errorView.messageText).toContainText(
            'There is already an account associated with that email address using a sign in method other than',
        );
        expect((await adminClient.getUser(existing.id)).auth_service).toBe('');
        await expect(adminClient.getUserByUsername(keycloakUser.username)).rejects.toThrow();
    },
);

/**
 * @objective Verify logging out after an OpenID login clears the Mattermost session.
 *
 * @precondition
 * A Keycloak realm with the mattermost-openid client, reachable at OpenIdSettings endpoints.
 */
test('logout invalidates a session created via OpenID', {tag: '@openid'}, async ({pw, page}) => {
    await pw.ensureLicense();
    await pw.skipIfNoLicense();
    await pw.ensureKeycloakOpenId();
    await pw.ensureSiteUrl();

    const {adminClient} = await pw.getAdminClient();
    const team = await pw.createNewTeam(adminClient);
    const keycloakUser = pw.generateKeycloakUser('openidlogout');
    await pw.createKeycloakUser(keycloakUser);

    // # Log in through OpenID and open the team's channel
    const app = await logInWithKeycloak(pw, page, 'openid', keycloakUser);
    await expectSignedIn(page);
    const provisionedUser = await adminClient.getUserByUsername(keycloakUser.username);
    await adminClient.addToTeam(team.id, provisionedUser.id);

    // # Dismiss the first-time onboarding tour so it doesn't cover the header
    await pw.setDefaultOnboardingPreferences(adminClient, provisionedUser.id);
    await app.channelsPage.goto({team, channel: DefaultChannel.TownSquare});

    // # Log out from the account menu
    await app.globalHeader.openAccountMenuButton.clickTo(app.globalHeader.accountMenu.logOutMenuItem);
    await settle(app.globalHeader.accountMenu.logOutMenuItem, {wait: Api.Logout}).click();

    // * Verify the session is cleared, and revisiting the team's channel redirects back to login
    await expect(page).toHavePath(app.loginPage.pathFor());
    await openSignedOut(page, `/${team.name}`);
    await expect(page).toHavePath(app.loginPage.pathFor());
});
