// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test} from '@mattermost/playwright-lib';

import {assertFullName, setupSamlUser} from './saml_ldap_sync_support';

test.describe('SAML and LDAP attribute synchronization', () => {
    test.describe.configure({mode: 'serial'});

    test.beforeEach(async ({pw}) => {
        await pw.ensureLicense();
        await pw.skipIfNoLicense();
    });

    /**
     * @objective Verify SAML attributes remain authoritative when SAML-to-LDAP synchronization is disabled
     *
     * @precondition
     * OpenLDAP and Keycloak are available
     */
    test(
        'MM-T3013_1 keeps SAML profile attributes when LDAP synchronization is disabled',
        {tag: '@saml'},
        async ({pw, page}) => {
            // # Register a matching SAML and LDAP user with intentionally different names
            const setup = await setupSamlUser(pw, page, {enableSyncWithLdap: false});

            // * Verify the live profile displays SAML attributes
            await assertFullName(setup.channelsPage, setup.samlUser.firstName, setup.samlUser.lastName);

            // # Synchronize LDAP while SAML-to-LDAP synchronization remains disabled
            await setup.adminClient.runLdapSync();
            await page.reload();

            // * Verify LDAP synchronization does not replace the SAML profile attributes
            await assertFullName(setup.channelsPage, setup.samlUser.firstName, setup.samlUser.lastName);
        },
    );

    /**
     * @objective Verify LDAP attributes replace SAML attributes when SAML-to-LDAP synchronization is enabled
     *
     * @precondition
     * OpenLDAP and Keycloak are available
     */
    test(
        'MM-T3013_2 synchronizes SAML profile attributes from LDAP when enabled',
        {tag: '@saml'},
        async ({pw, page}) => {
            // # Register a matching SAML and LDAP user with synchronization enabled
            const setup = await setupSamlUser(pw, page, {enableSyncWithLdap: true});

            // # Run LDAP synchronization after the initial SAML registration
            await setup.adminClient.runLdapSync();
            await page.reload();

            // * Verify LDAP attributes are authoritative in the live profile
            await assertFullName(setup.channelsPage, setup.ldapUser.firstName, setup.ldapUser.lastName);

            // # Change the LDAP names and run synchronization
            const firstName = `UpdatedFirst-${pw.random.id()}`;
            const lastName = `UpdatedLast-${pw.random.id()}`;
            await setup.ldap.updateUserNames(setup.ldapUser.username, firstName, lastName);
            await setup.adminClient.runLdapSync();
            await page.reload();

            // * Verify the live profile displays the updated LDAP attributes
            await assertFullName(setup.channelsPage, firstName, lastName);
        },
    );
});
