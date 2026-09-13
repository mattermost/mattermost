// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify an email/password user can switch their sign-in method to OpenID SSO.
 *
 * @precondition
 * A licensed server with Keycloak OpenID configured and authentication transfer enabled.
 */
test('switches an email account to OpenID SSO', {tag: '@authentication'}, async ({pw}) => {
    await pw.ensureLicense();
    await pw.skipIfNoLicense();
    await pw.ensureKeycloakOpenId();
    await pw.ensureSiteUrl();

    const {adminClient, user, team} = await pw.initSetup();
    const keycloakUser = {
        username: `kc${user.username}`,
        email: user.email,
        firstName: user.first_name || 'First',
        lastName: user.last_name || 'Last',
        password: 'Password1',
    };
    await pw.createKeycloakUser(keycloakUser);

    try {
        // # Log in as the email user and open Switch to OpenID
        await pw.hasSeenLandingPage();
        await pw.loginPage.goto();
        await pw.loginPage.toBeVisible();
        await pw.loginPage.login(user);
        await pw.channelsPage.goto(team.name);
        await pw.channelsPage.toBeVisible();

        const profileModal = await pw.channelsPage.openProfileModal();
        await profileModal.openSecurityTab();
        await profileModal.securityTab.clickSwitchToOpenId();
        await pw.emailToOAuthPage.toBeVisible();

        // # Confirm the current password and complete Keycloak login
        await pw.emailToOAuthPage.submit(user.password);
        await pw.keycloakLoginPage.login(keycloakUser.username, keycloakUser.password);

        // * Verify the account now authenticates through OpenID
        await pw.loginPage.expectOnLoginPage();
        const switched = await adminClient.getUser(user.id);
        expect(switched.auth_service).toBe('openid');
    } finally {
        await adminClient.patchConfig({OpenIdSettings: {Enable: false}});
    }
});
