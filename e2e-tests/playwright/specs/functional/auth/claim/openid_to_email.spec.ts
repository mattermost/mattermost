// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify an OpenID SSO user can switch their sign-in method to email and password.
 *
 * @precondition
 * A licensed server with Keycloak OpenID configured and authentication transfer enabled.
 */
test('switches an OpenID account to email and password', {tag: '@authentication'}, async ({pw}) => {
    await pw.ensureLicense();
    await pw.skipIfNoLicense();
    await pw.ensureKeycloakOpenId();
    await pw.ensureSiteUrl();

    const {adminClient, team} = await pw.initSetup();
    const keycloakUser = pw.generateKeycloakUser('openidclaim');
    await pw.createKeycloakUser(keycloakUser);
    const newPassword = pw.newTestPassword();

    try {
        // # Provision the user through OpenID SSO
        await pw.hasSeenLandingPage();
        await pw.loginPage.goto();
        await pw.loginPage.toBeVisible();
        await pw.loginPage.openIdLoginButton.click();
        await pw.keycloakLoginPage.login(keycloakUser.username, keycloakUser.password);
        await pw.loginPage.expectNotOnLoginPage();

        const provisionedUser = await adminClient.getUserByUsername(keycloakUser.username);
        await adminClient.addToTeam(team.id, provisionedUser.id);
        await pw.channelsPage.goto(team.name);
        await pw.channelsPage.toBeVisible();

        // # Open Switch to Email and Password and set a new password
        const profileModal = await pw.channelsPage.openProfileModal();
        await profileModal.openSecurityTab();
        await profileModal.securityTab.clickSwitchToEmail();
        await pw.oauthToEmailPage.toBeVisible();
        await pw.oauthToEmailPage.submit(newPassword);

        // * Verify the account now authenticates with email/password
        await pw.loginPage.expectOnLoginPage();
        const switched = await adminClient.getUser(provisionedUser.id);
        expect(switched.auth_service).toBe('');

        // # Log in with the new email password
        await pw.loginPage.submitCredentials(provisionedUser.email, newPassword);

        // * Verify email login succeeds
        await pw.loginPage.expectNotOnLoginPage();
    } finally {
        await adminClient.patchConfig({OpenIdSettings: {Enable: false}});
    }
});
