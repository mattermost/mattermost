// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

import {runLdapSyncAndWait} from './ldap_sync_wait';

/**
 * @objective Verify that when EnableSyncWithLdap is on and a synced user is removed from LDAP,
 * running an LDAP sync deactivates their Mattermost account.
 *
 * @precondition
 * Keycloak and OpenLDAP running, with matching users in both directories.
 */
test(
    'MM-T3665 removing a synced user from LDAP deactivates their Mattermost account on sync',
    {tag: '@saml'},
    async ({pw}) => {
        test.setTimeout(180_000);
        await pw.ensureLicense();
        await pw.skipIfNoLicense();

        const {adminClient} = await pw.getAdminClient();
        const originalConfig = await adminClient.getConfig();
        let keeper: {username: string} | undefined;
        try {
            await pw.ensureOpenldap();
            await pw.ensureKeycloak();
            keeper = await pw.createLdapUser();
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
            // LDAP sync errors when BaseDN is empty, so keep `keeper` in the directory.
            await pw.deleteLdapUser(sharedUsername);
            await adminClient.patchConfig({
                LdapSettings: {EnableSync: true},
                SamlSettings: {EnableSyncWithLdap: true},
            });
            await runLdapSyncAndWait(adminClient);

            // * Verify the sync deactivated the account
            await expect(async () => {
                const syncedUser = await adminClient.getUser(provisionedUser.id);
                expect(syncedUser.delete_at).toBeGreaterThan(0);
            }).toPass({timeout: 30_000});
        } finally {
            if (keeper) {
                await pw.deleteLdapUser(keeper.username).catch(() => undefined);
            }
            await adminClient.patchConfig({
                LdapSettings: originalConfig.LdapSettings,
                SamlSettings: originalConfig.SamlSettings,
            });
        }
    },
);

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
