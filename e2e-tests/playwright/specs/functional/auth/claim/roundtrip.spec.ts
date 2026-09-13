// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify an email account can switch to OpenID and back to email in one session.
 *
 * @precondition
 * A licensed server with Keycloak OpenID configured and authentication transfer enabled.
 */
test('round-trips an email account through OpenID and back to email', {tag: '@authentication'}, async ({pw}) => {
    test.setTimeout(pw.duration.two_min);

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
    const newPassword = pw.newTestPassword();

    try {
        // # Log in as the email user and switch to OpenID
        await pw.hasSeenLandingPage();
        await pw.loginPage.goto();
        await pw.loginPage.toBeVisible();
        await pw.loginPage.login(user);
        await pw.channelsPage.goto(team.name);
        await pw.channelsPage.toBeVisible();

        let profileModal = await pw.channelsPage.openProfileModal();
        await profileModal.openSecurityTab();
        await profileModal.securityTab.clickSwitchToOpenId();
        await pw.emailToOAuthPage.toBeVisible();
        await pw.emailToOAuthPage.submit(user.password);
        await pw.keycloakLoginPage.login(keycloakUser.username, keycloakUser.password);
        await pw.loginPage.expectOnLoginPage();

        const afterOpenId = await adminClient.getUser(user.id);
        expect(afterOpenId.auth_service).toBe('openid');

        // # Log in through OpenID and switch back to email
        await pw.loginPage.openIdLoginButton.click();
        await pw.keycloakLoginPage.loginIfFormShown(keycloakUser.username, keycloakUser.password);
        await pw.loginPage.expectNotOnLoginPage();
        await pw.channelsPage.goto(team.name);
        await pw.channelsPage.toBeVisible();

        profileModal = await pw.channelsPage.openProfileModal();
        await profileModal.openSecurityTab();
        await profileModal.securityTab.clickSwitchToEmail();
        await pw.oauthToEmailPage.toBeVisible();
        await pw.oauthToEmailPage.submit(newPassword);
        await pw.loginPage.expectOnLoginPage();

        // * Verify the account authenticates with the new email password
        const afterEmail = await adminClient.getUser(user.id);
        expect(afterEmail.auth_service).toBe('');
        await pw.loginPage.submitCredentials(user.email, newPassword);
        await pw.loginPage.expectNotOnLoginPage();
    } finally {
        await adminClient.patchConfig({OpenIdSettings: {Enable: false}});
    }
});
