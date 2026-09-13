// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify a directory user that does not match SamlSettings.GuestAttribute is
 * provisioned as a regular member on first SAML login.
 *
 * @precondition
 * A Keycloak realm reachable at SamlSettings.IdpURL, with a SAML client matching
 * ServiceProviderIdentifier.
 */
test('SAML login provisions a member when the guest attribute does not match', {tag: '@saml'}, async ({pw}) => {
    await pw.ensureLicense();
    await pw.skipIfNoLicense();
    await pw.ensureKeycloak();

    const {adminClient} = await pw.getAdminClient();
    await adminClient.patchConfig({
        GuestAccountsSettings: {Enable: true},
        SamlSettings: {GuestAttribute: 'username=no-such-user'},
    });

    const keycloakUser = pw.generateKeycloakUser('samlmember');
    await pw.createKeycloakUser(keycloakUser);

    // # Log in via SAML with a user that does not match the guest attribute
    await pw.hasSeenLandingPage();
    await pw.loginPage.goto();
    await pw.loginPage.toBeVisible();
    await pw.loginPage.samlLoginButton.click();
    await pw.keycloakLoginPage.login(keycloakUser.username, keycloakUser.password);

    // * Verify the user was provisioned as a regular member
    await pw.loginPage.expectNotOnLoginPage();
    const provisionedUser = await adminClient.getUserByUsername(keycloakUser.username);
    expect(provisionedUser.roles.split(' ')).not.toContain('system_guest');
});

/**
 * @objective Verify a directory user matching SamlSettings.GuestAttribute is provisioned as a
 * guest on first SAML login.
 *
 * @precondition
 * A Keycloak realm reachable at SamlSettings.IdpURL, with a SAML client matching
 * ServiceProviderIdentifier.
 */
test('SAML guest attribute provisions the user as a guest', {tag: '@saml'}, async ({pw}) => {
    await pw.ensureLicense();
    await pw.skipIfNoLicense();
    await pw.ensureKeycloak();

    const {adminClient} = await pw.getAdminClient();
    const keycloakUser = pw.generateKeycloakUser('samlguest');
    await pw.createKeycloakUser(keycloakUser);
    await adminClient.patchConfig({
        GuestAccountsSettings: {Enable: true},
        SamlSettings: {GuestAttribute: `username=${keycloakUser.username}`},
    });

    // # Log in via SAML with a user that matches the guest attribute
    await pw.hasSeenLandingPage();
    await pw.loginPage.goto();
    await pw.loginPage.toBeVisible();
    await pw.loginPage.samlLoginButton.click();
    await pw.keycloakLoginPage.login(keycloakUser.username, keycloakUser.password);

    // * Verify the user was provisioned as a guest
    await pw.loginPage.expectNotOnLoginPage();
    const provisionedUser = await adminClient.getUserByUsername(keycloakUser.username);
    expect(provisionedUser.roles.split(' ')).toContain('system_guest');
});
