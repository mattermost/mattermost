// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify that with SamlSettings.EnableSyncWithLdap on, changing a synced user's name
 * in the Mattermost-configured LDAP directory and running an LDAP sync updates their Mattermost
 * profile to the new LDAP value, proving the sync pulls from LDAP rather than the (unchanged)
 * SAML assertion.
 *
 * @precondition
 * A Keycloak realm reachable at the configured SamlSettings.IdpURL, and an LDAP directory
 * reachable at the configured LdapSettings.LdapServer/LdapPort, sharing a matching username.
 */
test(
    'SAML login syncs profile attributes from the LDAP directory when enabled',
    {tag: ['@saml', '@ldap']},
    async ({pw}) => {
        await pw.ensureLicense();
        await pw.skipIfNoLicense();
        await pw.ensureOpenldap();
        await pw.ensureKeycloak();

        const {adminClient} = await pw.getAdminClient();
        await adminClient.patchConfig({
            LdapSettings: {EnableSync: true},
            SamlSettings: {EnableSyncWithLdap: true},
        });

        // # Create matching directory entries in both LDAP and Keycloak, sharing one username and
        // the same initial name, so a later divergence can only have come from LDAP.
        const sharedUsername = `samlldapsync${Date.now()}`;
        await pw.createLdapUser({
            username: sharedUsername,
            password: 'Password1',
            email: `${sharedUsername}@mmtest.com`,
            firstname: 'OriginalFirstname',
            lastname: 'OriginalLastname',
        });
        await pw.createKeycloakUser({
            username: sharedUsername,
            password: 'Password1',
            email: `${sharedUsername}@mmtest.com`,
            firstName: 'OriginalFirstname',
            lastName: 'OriginalLastname',
        });

        // # Log in through the SAML SSO button to provision the account
        await pw.hasSeenLandingPage();
        await pw.loginPage.goto();
        await pw.loginPage.toBeVisible();
        await pw.loginPage.samlLoginButton.click();
        await pw.keycloakLoginPage.login(sharedUsername, 'Password1');
        await expect(pw.loginPage.page).not.toHaveURL(/\/login/);

        // # Change the name in LDAP only (Keycloak's SAML assertion still has the original name)
        await pw.updateLdapUser(sharedUsername, {firstname: 'UpdatedFirstname', lastname: 'UpdatedLastname'});
        await adminClient.syncLdap();

        // * Verify the profile picked up the new LDAP value, not the still-original SAML assertion
        await expect(async () => {
            const provisionedUser = await adminClient.getUserByUsername(sharedUsername);
            expect(provisionedUser.auth_service).toBe('saml');
            expect(provisionedUser.first_name).toBe('UpdatedFirstname');
            expect(provisionedUser.last_name).toBe('UpdatedLastname');
        }).toPass({timeout: 30_000});
    },
);

/**
 * @objective Verify that when SamlSettings.EnableSyncWithLdap is on and a synced user is removed
 * from the LDAP directory, running an LDAP sync deactivates their Mattermost account.
 *
 * @precondition
 * A Keycloak realm reachable at the configured SamlSettings.IdpURL, and an LDAP directory
 * reachable at the configured LdapSettings.LdapServer/LdapPort, sharing a matching username.
 */
test(
    'removing a synced user from LDAP deactivates their Mattermost account on sync',
    {tag: ['@saml', '@ldap']},
    async ({pw}) => {
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
        await expect(pw.loginPage.page).not.toHaveURL(/\/login/);

        // * Verify the account is active right after provisioning
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
    },
);
