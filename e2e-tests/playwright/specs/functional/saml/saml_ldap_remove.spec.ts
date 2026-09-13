// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify that when EnableSyncWithLdap is on and a synced user is removed from LDAP,
 * running an LDAP sync deactivates their Mattermost account.
 *
 * @precondition
 * Keycloak and OpenLDAP running, with matching users in both directories.
 */
test('removing a synced user from LDAP deactivates their Mattermost account on sync', {tag: '@saml'}, async ({pw}) => {
    await pw.ensureLicense();
    await pw.skipIfNoLicense();
    await pw.ensureOpenldap();
    await pw.ensureKeycloak();

    const {adminClient} = await pw.getAdminClient();
    await adminClient.patchConfig({
        LdapSettings: {EnableSync: true},
        SamlSettings: {EnableSyncWithLdap: true},
    });

    const sharedUsername = `samlldapremove${Date.now()}`;
    await pw.createLdapUser({
        username: sharedUsername,
        password: 'Password1',
        email: `${sharedUsername}@mmtest.com`,
        firstname: 'Firstname',
        lastname: 'Lastname',
    });
    await pw.createKeycloakUser({
        username: sharedUsername,
        password: 'Password1',
        email: `${sharedUsername}@mmtest.com`,
        firstName: 'Firstname',
        lastName: 'Lastname',
    });

    // # Log in once via SAML to provision the account
    await pw.hasSeenLandingPage();
    await pw.loginPage.goto();
    await pw.loginPage.toBeVisible();
    await pw.loginPage.samlLoginButton.click();
    await pw.keycloakLoginPage.login(sharedUsername, 'Password1');
    await pw.loginPage.expectNotOnLoginPage();

    const provisionedUser = await adminClient.getUserByUsername(sharedUsername);
    expect(provisionedUser.delete_at).toBe(0);

    // # Remove the user from LDAP and run a sync
    await pw.deleteLdapUser(sharedUsername);
    await adminClient.syncLdap();

    // * Verify the sync deactivated the account
    await expect(async () => {
        const syncedUser = await adminClient.getUser(provisionedUser.id);
        expect(syncedUser.delete_at).toBeGreaterThan(0);
    }).toPass({timeout: 30_000});
});

/**
 * @objective Verify a SAML user who is not present in LDAP cannot log in while
 * EnableSyncWithLdap is on, then succeeds after they are added to LDAP.
 *
 * @precondition
 * Keycloak and OpenLDAP running.
 */
test('SAML login is rejected when the user is not registered in LDAP', {tag: '@saml'}, async ({pw}) => {
    await pw.ensureLicense();
    await pw.skipIfNoLicense();
    await pw.ensureOpenldap();
    await pw.ensureKeycloak();

    const {adminClient} = await pw.getAdminClient();
    await adminClient.patchConfig({
        LdapSettings: {EnableSync: true},
        SamlSettings: {EnableSyncWithLdap: true},
    });

    const username = `samlnoldap${Date.now()}`;
    const email = `${username}@mmtest.com`;
    await pw.createKeycloakUser({
        username,
        password: 'Password1',
        email,
        firstName: 'NoLdapFirst',
        lastName: 'NoLdapLast',
    });

    // # Attempt SAML login while the user exists only in Keycloak
    await pw.hasSeenLandingPage();
    await pw.loginPage.goto();
    await pw.loginPage.toBeVisible();
    await pw.loginPage.samlLoginButton.click();
    await pw.keycloakLoginPage.login(username, 'Password1');

    // * Verify the login is rejected because the user is not in LDAP
    await expect(pw.loginPage.userNotRegisteredOnLdapError).toBeVisible();

    // # Create the matching LDAP user and retry SAML login
    await pw.createLdapUser({
        username,
        password: 'Password1',
        email,
        firstname: 'NoLdapFirst',
        lastname: 'NoLdapLast',
    });
    await pw.loginPage.goto();
    await pw.loginPage.toBeVisible();
    await pw.loginPage.samlLoginButton.click();
    await pw.keycloakLoginPage.login(username, 'Password1');

    // * Verify the login succeeds once the user exists in LDAP
    await pw.loginPage.expectNotOnLoginPage();
    const provisionedUser = await adminClient.getUserByUsername(username);
    expect(provisionedUser.auth_service).toBe('saml');
});
