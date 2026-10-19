// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify a SAML user who is not present in LDAP cannot log in while
 * EnableSyncWithLdap is on, then succeeds after they are added to LDAP.
 *
 * @precondition
 * Keycloak and OpenLDAP running.
 */
test('MM-T3664 SAML login is rejected when the user is not registered in LDAP', {tag: '@saml'}, async ({pw}) => {
    await pw.ensureLicense();
    await pw.skipIfNoLicense();

    const {adminClient} = await pw.getAdminClient();
    const originalConfig = await adminClient.getConfig();
    try {
        await pw.ensureOpenldap();
        await pw.ensureKeycloak();
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
        await pw.keycloakLoginPage.logout();
        await pw.hasSeenLandingPage();
        await pw.loginPage.goto();
        await pw.loginPage.toBeVisible();
        await pw.loginPage.samlLoginButton.click();
        await pw.keycloakLoginPage.login(username, 'Password1');

        // * Verify the login is rejected because the user is not in LDAP
        await pw.errorPage.toBeVisible();
        await expect(pw.errorPage.userNotRegisteredOnLdap).toBeVisible();

        // # Create the matching LDAP user and retry SAML login
        await pw.createLdapUser({
            username,
            password: 'Password1',
            email,
            firstname: 'NoLdapFirst',
            lastname: 'NoLdapLast',
        });
        await pw.keycloakLoginPage.logout();
        await pw.loginPage.goto();
        await pw.loginPage.toBeVisible();
        await pw.loginPage.samlLoginButton.click();
        await pw.keycloakLoginPage.loginIfFormShown(username, 'Password1');

        // * Verify the login succeeds once the user exists in LDAP
        await pw.loginPage.expectNotOnLoginPage();
        const provisionedUser = await adminClient.getUserByUsername(username);
        expect(provisionedUser.auth_service).toBe('saml');
    } finally {
        await adminClient.patchConfig({
            LdapSettings: originalConfig.LdapSettings,
            SamlSettings: originalConfig.SamlSettings,
        });
    }
});
