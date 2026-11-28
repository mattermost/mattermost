// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, expectSignedIn, logInWithKeycloak, test, testConfig} from '@mattermost/playwright-lib';

/**
 * @objective Verify a SAML user who is not present in LDAP cannot log in while
 * EnableSyncWithLdap is on, then succeeds after they are added to LDAP.
 *
 * @precondition
 * Keycloak and OpenLDAP running.
 */
test('MM-T3664 SAML login is rejected when the user is not registered in LDAP', {tag: '@saml'}, async ({pw, page}) => {
    test.skip(
        testConfig.subpathMode,
        'Known product bug: the server signs the error page URL with the subpath but the webapp verifies it without, so the error message is never shown under a subpath.',
    );

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
        const app = await logInWithKeycloak(pw, page, 'saml', {username, password: 'Password1'});

        // * Verify the login is rejected because the user is not in LDAP
        await expect(app.errorView.messageText).toBeVisible();
        await expect(app.errorView.messageText).toHaveText(
            'No user registered on AD/LDAP server that matches the SAML user.',
        );
        await expect(adminClient.getUserByUsername(username)).rejects.toThrow();

        // # Create the matching LDAP user and retry SAML login
        await pw.createLdapUser({
            username,
            password: 'Password1',
            email,
            firstname: 'NoLdapFirst',
            lastname: 'NoLdapLast',
        });
        await pw.keycloakLoginPage.logout();
        await logInWithKeycloak(pw, page, 'saml', {username, password: 'Password1'}, {ifFormShown: true});

        // * Verify the login succeeds once the user exists in LDAP
        await expectSignedIn(page);
        const provisionedUser = await adminClient.getUserByUsername(username);
        expect(provisionedUser.auth_service).toBe('saml');
    } finally {
        await adminClient.patchConfig({
            LdapSettings: originalConfig.LdapSettings,
            SamlSettings: originalConfig.SamlSettings,
        });
    }
});
