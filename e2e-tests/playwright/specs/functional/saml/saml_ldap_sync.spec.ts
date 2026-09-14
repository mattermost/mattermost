// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

import {runLdapSyncAndWait} from './ldap_sync_wait';

/**
 * @objective Verify that with EnableSyncWithLdap on, an LDAP name change is pulled into the
 * Mattermost profile on sync rather than the unchanged SAML assertion.
 *
 * @precondition
 * Keycloak and OpenLDAP running, with matching users in both directories.
 */
test(
    'MM-T3013_2 SAML login syncs profile attributes from the LDAP directory when enabled',
    {tag: '@saml'},
    async ({pw}) => {
        test.setTimeout(180_000);
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

            // # Log in through SAML to provision the account
            await pw.hasSeenLandingPage();
            await pw.loginPage.goto();
            await pw.loginPage.toBeVisible();
            await pw.loginPage.samlLoginButton.click();
            await pw.keycloakLoginPage.login(sharedUsername, 'Password1');
            await pw.loginPage.expectNotOnLoginPage();

            // # Change the name in LDAP only and run a sync
            await pw.updateLdapUser(sharedUsername, {firstname: 'UpdatedFirstname', lastname: 'UpdatedLastname'});
            await runLdapSyncAndWait(adminClient);

            // * Verify the profile picked up the new LDAP value
            await expect(async () => {
                const provisionedUser = await adminClient.getUserByUsername(sharedUsername);
                expect(provisionedUser.auth_service).toBe('saml');
                expect(provisionedUser.first_name).toBe('UpdatedFirstname');
                expect(provisionedUser.last_name).toBe('UpdatedLastname');
            }).toPass({timeout: 30_000});
        } finally {
            await adminClient.patchConfig({
                LdapSettings: originalConfig.LdapSettings,
                SamlSettings: originalConfig.SamlSettings,
            });
        }
    },
);

/**
 * @objective Verify that with EnableSyncWithLdap off, an LDAP name change is not applied and the
 * profile keeps the SAML assertion values.
 *
 * @precondition
 * Keycloak and OpenLDAP running, with matching users in both directories.
 */
test('MM-T3013_1 SAML login keeps SAML attributes when LDAP sync is disabled', {tag: '@saml'}, async ({pw}) => {
    test.setTimeout(180_000);
    await pw.ensureLicense();
    await pw.skipIfNoLicense();

    const {adminClient} = await pw.getAdminClient();
    const originalConfig = await adminClient.getConfig();
    try {
        await pw.ensureOpenldap();
        await pw.ensureKeycloak();
        await adminClient.patchConfig({
            LdapSettings: {EnableSync: true},
            SamlSettings: {EnableSyncWithLdap: false},
        });

        const sharedUsername = `samlldapoff${Date.now()}`;
        await pw.createLdapUser({
            username: sharedUsername,
            password: 'Password1',
            email: `${sharedUsername}@mmtest.com`,
            firstname: 'SamlFirstname',
            lastname: 'SamlLastname',
        });
        await pw.createKeycloakUser({
            username: sharedUsername,
            password: 'Password1',
            email: `${sharedUsername}@mmtest.com`,
            firstName: 'SamlFirstname',
            lastName: 'SamlLastname',
        });

        // # Log in through SAML to provision the account
        await pw.hasSeenLandingPage();
        await pw.loginPage.goto();
        await pw.loginPage.toBeVisible();
        await pw.loginPage.samlLoginButton.click();
        await pw.keycloakLoginPage.login(sharedUsername, 'Password1');
        await pw.loginPage.expectNotOnLoginPage();

        // # Change the name in LDAP only and run a sync
        await pw.updateLdapUser(sharedUsername, {firstname: 'LdapFirstname', lastname: 'LdapLastname'});
        await runLdapSyncAndWait(adminClient);

        // * Verify the profile still has the original SAML values
        await expect(async () => {
            const provisionedUser = await adminClient.getUserByUsername(sharedUsername);
            expect(provisionedUser.auth_service).toBe('saml');
            expect(provisionedUser.first_name).toBe('SamlFirstname');
            expect(provisionedUser.last_name).toBe('SamlLastname');
        }).toPass({timeout: 30_000});
    } finally {
        await adminClient.patchConfig({
            LdapSettings: originalConfig.LdapSettings,
            SamlSettings: originalConfig.SamlSettings,
        });
    }
});

/**
 * @objective Verify SAML/LDAP sync still updates profile attributes when matching by a custom
 * IdAttribute instead of email.
 *
 * @precondition
 * Keycloak and OpenLDAP running, with matching users in both directories.
 */
test('MM-T3666 SAML LDAP sync uses a custom ID Attribute mapping', {tag: '@saml'}, async ({pw}) => {
    test.setTimeout(180_000);
    await pw.ensureLicense();
    await pw.skipIfNoLicense();

    const {adminClient} = await pw.getAdminClient();
    const originalConfig = await adminClient.getConfig();
    try {
        await pw.ensureOpenldap();
        await pw.ensureKeycloak();
        await adminClient.patchConfig({
            LdapSettings: {EnableSync: true},
            SamlSettings: {
                EnableSyncWithLdap: true,
                EnableSyncWithLdapIncludeAuth: true,
                IdAttribute: 'username',
            },
        });

        const sharedUsername = `samlldapid${Date.now()}`;
        await pw.createLdapUser({
            username: sharedUsername,
            password: 'Password1',
            email: `${sharedUsername}@ldap.mmtest.com`,
            firstname: 'IdFirstname',
            lastname: 'IdLastname',
        });
        await pw.createKeycloakUser({
            username: sharedUsername,
            password: 'Password1',
            email: `${sharedUsername}@saml.mmtest.com`,
            firstName: 'IdFirstname',
            lastName: 'IdLastname',
        });

        // # Log in through SAML to provision the account
        await pw.hasSeenLandingPage();
        await pw.loginPage.goto();
        await pw.loginPage.toBeVisible();
        await pw.loginPage.samlLoginButton.click();
        await pw.keycloakLoginPage.login(sharedUsername, 'Password1');
        await pw.loginPage.expectNotOnLoginPage();

        // # Change the name in LDAP only and run a sync
        await pw.updateLdapUser(sharedUsername, {firstname: 'IdUpdatedFirst', lastname: 'IdUpdatedLast'});
        await runLdapSyncAndWait(adminClient);

        // * Verify the profile picked up the new LDAP value via the custom ID mapping
        await expect(async () => {
            const provisionedUser = await adminClient.getUserByUsername(sharedUsername);
            expect(provisionedUser.auth_service).toBe('saml');
            expect(provisionedUser.first_name).toBe('IdUpdatedFirst');
            expect(provisionedUser.last_name).toBe('IdUpdatedLast');
        }).toPass({timeout: 30_000});
    } finally {
        await adminClient.patchConfig({
            LdapSettings: originalConfig.LdapSettings,
            SamlSettings: originalConfig.SamlSettings,
        });
    }
});
