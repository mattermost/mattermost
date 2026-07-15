// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {duration, expect, test} from '@mattermost/playwright-lib';

import {addUserToNewTeam, assertFullName, setupSamlUser} from './saml_ldap_sync_support';

test.describe('SAML and LDAP registration and account lifecycle', () => {
    test.describe.configure({mode: 'serial'});

    test.beforeEach(async ({pw}) => {
        await pw.ensureLicense();
        await pw.skipIfNoLicense();
    });

    /**
     * @objective Verify SAML login is rejected until the user is registered in LDAP
     *
     * @precondition
     * OpenLDAP and Keycloak are available
     */
    test('MM-T3664 allows a SAML user to log in only after LDAP registration', {tag: '@saml'}, async ({pw, page}) => {
        // # Configure synchronized SAML and create the user only in Keycloak
        const setup = await setupSamlUser(pw, page, {enableSyncWithLdap: true, createInLdap: false});

        // * Verify Mattermost rejects the SAML user missing from LDAP
        await setup.loginPage.assertError('No user registered on AD/LDAP server that matches the SAML user.');

        // # Register the same user in LDAP and complete SAML registration
        await setup.ldap.createUser(setup.ldapUser);
        await setup.keycloakLoginPage.login(setup.samlUser);

        // # Synchronize the registered account and add it to a team
        await setup.adminClient.runLdapSync();
        await addUserToNewTeam(pw, setup.adminClient, setup.ldapUser.email);
        const mattermostUser = await setup.adminClient.getUserByEmail(setup.ldapUser.email);
        await page.goto('about:blank');
        await page.context().clearCookies();
        await setup.adminClient.revokeAllSessionsForUser(mattermostUser.id);

        // # Log in through SAML again
        await setup.keycloakLoginPage.login(setup.samlUser);

        // * Verify login succeeds and the user can post in a channel
        await setup.channelsPage.toBeVisible();
        const message = `SAML LDAP login ${pw.random.id()}`;
        await setup.channelsPage.postMessage(message);
        await expect(page.getByText(message, {exact: true}).last()).toBeVisible({timeout: duration.half_min});
        await setup.adminClient.runLdapSync();
        await page.reload();
        await assertFullName(setup.channelsPage, setup.ldapUser.firstName, setup.ldapUser.lastName);
    });

    /**
     * @objective Verify disabling and re-enabling a Keycloak user controls SAML login
     *
     * @precondition
     * OpenLDAP and Keycloak are available
     */
    test(
        'MM-T3665 rejects a disabled SAML user and restores login after reactivation',
        {tag: '@saml'},
        async ({pw, page}) => {
            // # Register and authenticate a synchronized SAML and LDAP user
            const setup = await setupSamlUser(pw, page, {enableSyncWithLdap: true});

            // # Disable the user in Keycloak and attempt another login
            await setup.keycloak.setUserEnabled(setup.samlUser.email, false);
            await setup.keycloakLoginPage.login(setup.samlUser, false);

            // * Verify Keycloak rejects the disabled account
            await setup.keycloakLoginPage.assertAccountDisabled();

            // # Reactivate the Keycloak user and log in again
            await setup.keycloak.setUserEnabled(setup.samlUser.email, true);
            await setup.keycloakLoginPage.login(setup.samlUser);

            // * Verify SAML login and synchronized profile access are restored
            await setup.channelsPage.toBeVisible();
            const message = `Reactivated SAML user ${pw.random.id()}`;
            await setup.channelsPage.postMessage(message);
            await expect(page.getByText(message, {exact: true}).last()).toBeVisible({timeout: duration.half_min});
            await setup.adminClient.runLdapSync();
            await page.reload();
            await assertFullName(setup.channelsPage, setup.ldapUser.firstName, setup.ldapUser.lastName);
        },
    );

    /**
     * @objective Verify SAML-to-LDAP synchronization matches users by the configured ID attribute
     *
     * @precondition
     * OpenLDAP and Keycloak are available
     */
    test('MM-T3666 synchronizes SAML users by the LDAP ID attribute', {tag: '@saml'}, async ({pw, page}) => {
        // # Register a synchronized user whose SAML and LDAP username ID attributes match
        const setup = await setupSamlUser(pw, page, {enableSyncWithLdap: true});

        // # Run LDAP synchronization after the initial SAML registration
        await setup.adminClient.runLdapSync();
        await page.reload();

        // * Verify the initial LDAP profile attributes
        await assertFullName(setup.channelsPage, setup.ldapUser.firstName, setup.ldapUser.lastName);

        // # Update the LDAP names for the same ID attribute and synchronize
        const firstName = `IdFirst-${pw.random.id()}`;
        const lastName = `IdLast-${pw.random.id()}`;
        await setup.ldap.updateUserNames(setup.ldapUser.username, firstName, lastName);
        await setup.adminClient.runLdapSync();
        await page.reload();

        // * Verify synchronization updates the existing SAML user
        await assertFullName(setup.channelsPage, firstName, lastName);
        const user = await setup.adminClient.getUserByEmail(setup.ldapUser.email);
        expect(user.username).toBe(setup.ldapUser.username);
    });
});
