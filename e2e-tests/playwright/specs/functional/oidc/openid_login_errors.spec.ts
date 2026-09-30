// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify a wrong password on Keycloak's hosted login page never creates a Mattermost
 * session or account.
 *
 * @precondition
 * A Keycloak realm with the mattermost-openid client, reachable at OpenIdSettings endpoints.
 */
test('login fails gracefully with wrong Keycloak credentials', {tag: '@openid'}, async ({pw}) => {
    await pw.ensureLicense();
    await pw.skipIfNoLicense();
    await pw.ensureKeycloakOpenId();
    await pw.ensureSiteUrl();

    const {adminClient} = await pw.getAdminClient();
    const keycloakUser = pw.generateKeycloakUser('openidbad');
    await pw.createKeycloakUser(keycloakUser);

    // # Submit the wrong password on Keycloak's hosted form
    await pw.hasSeenLandingPage();
    await pw.loginPage.goto();
    await pw.loginPage.toBeVisible();
    await pw.loginPage.openIdLoginButton.click();
    await pw.keycloakLoginPage.login(keycloakUser.username, 'WrongPassword1');

    // * Verify Keycloak rejects the login
    await expect(pw.keycloakLoginPage.errorMessage).toBeVisible();
    await expect(pw.keycloakLoginPage.usernameInput).toBeVisible();

    // * Verify no Mattermost account was created
    await expect(adminClient.getUserByUsername(keycloakUser.username)).rejects.toThrow();
});

/**
 * @objective Verify a Keycloak user suspended via the admin API cannot authenticate through OpenID.
 *
 * @precondition
 * A Keycloak realm with the mattermost-openid client, reachable at OpenIdSettings endpoints.
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

    // # Submit valid credentials for the suspended user
    await pw.hasSeenLandingPage();
    await pw.loginPage.goto();
    await pw.loginPage.toBeVisible();
    await pw.loginPage.openIdLoginButton.click();
    await pw.keycloakLoginPage.login(keycloakUser.username, keycloakUser.password);

    // * Verify Keycloak keeps the user on its disabled-account page
    await expect(pw.keycloakLoginPage.accountDisabledMessage).toBeVisible();

    // * Verify no Mattermost account was created
    await expect(adminClient.getUserByUsername(keycloakUser.username)).rejects.toThrow();
});

/**
 * @objective Verify the OpenID login button's visibility follows OpenIdSettings.Enable.
 *
 * @precondition
 * A Keycloak realm with the mattermost-openid client, reachable at OpenIdSettings endpoints.
 */
test('OpenID button visibility follows config', {tag: '@openid'}, async ({pw}) => {
    await pw.ensureLicense();
    await pw.skipIfNoLicense();

    const {adminClient} = await pw.getAdminClient();
    await pw.hasSeenLandingPage();

    try {
        // # Disable OpenID and load the login page
        await adminClient.patchConfig({OpenIdSettings: {Enable: false}});
        await pw.loginPage.goto();
        await pw.loginPage.toBeVisible();

        // * Verify the button is hidden
        await expect(pw.loginPage.openIdLoginButton).toBeHidden();
    } finally {
        await pw.ensureKeycloakOpenId();
    }

    // # Reload with OpenID enabled
    await pw.loginPage.goto();
    await pw.loginPage.toBeVisible();

    // * Verify the button is visible
    await expect(pw.loginPage.openIdLoginButton).toBeVisible();
});
