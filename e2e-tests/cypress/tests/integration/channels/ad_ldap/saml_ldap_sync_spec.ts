// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// - Requires openldap and keycloak running
// - Requires keycloak certificate at fixtures folder
//  -> copy ./mattermost-server/build/docker/keycloak/keycloak.crt to ./mattermost-webapp/e2e/cypress/tests/fixtures/keycloak.crt
// - Requires Cypress' chromeWebSecurity to be false

// Group: @channels @enterprise @ldap @saml @keycloak

import {LdapUser} from 'tests/support/ldap_server_commands';
import {getAdminAccount} from '../../../support/env';
import {getRandomId} from '../../../utils';
import {getKeycloakServerSettings} from '../../../utils/config';

describe('AD / LDAP', () => {
    const admin = getAdminAccount();
    const samlConfig = getKeycloakServerSettings();

    let samlLdapUser: LdapUser;
    let testTeamId: string;

    before(() => {
        cy.shouldNotRunOnCloudEdition();
        cy.apiRequireLicenseForFeature('LDAP', 'SAML');

        // # Create new LDAP user
        cy.createLDAPUser().then((user) => {
            samlLdapUser = user;
        });

        // # Create new team
        cy.apiCreateTeam('saml-team', 'SAML Team').then(({team}) => {
            testTeamId = team.id;
        });

        cy.apiUpdateConfig(samlConfig).then(() => {
            // # Require keycloak with realm setup
            cy.apiRequireKeycloak();

            // # Upload certificate, overwrite existing
            cy.apiUploadSAMLIDPCert('keycloak.crt');

            // # Create Keycloak user and login for the first time
            cy.keycloakCreateUsers([samlLdapUser]);
            cy.doKeycloakLogin(samlLdapUser);

            // # Wait for the UI to be ready which indicates SAML registration is complete
            cy.findByText('Logout').click();

            // # Add user to team
            cy.apiAdminLogin();
            cy.apiGetUserByEmail(samlLdapUser.email).then(({user}) => {
                cy.apiAddUserToTeam(testTeamId, user.id);
            });
        });
    });

    it('MM-T3013_1 - SAML LDAP Sync Off, user attributes pulled from SAML', () => {
        // # Login to Keycloak
        cy.doKeycloakLogin(samlLdapUser);

        // * Check the user settings
        cy.verifyAccountNameSettings(samlLdapUser.firstname, samlLdapUser.lastname);

        // # Run LDAP Sync
        cy.runLdapSync(admin);

        // Refresh make sure user not logged out.
        cy.reload();

        // * Check the user settings
        cy.verifyAccountNameSettings(samlLdapUser.firstname, samlLdapUser.lastname);
    });

    it('MM-T3013_2 - SAML LDAP Sync On, user attributes pulled from LDAP', () => {
        const testConfig = {
            ...samlConfig,
            SamlSettings: {
                ...samlConfig.SamlSettings,
                EnableSyncWithLdap: true,
            },
        };
        cy.apiAdminLogin();
        cy.apiUpdateConfig(testConfig);

        // # Login to Keycloak
        cy.doKeycloakLogin(samlLdapUser);

        // * Check the user settings
        cy.verifyAccountNameSettings(samlLdapUser.firstname, samlLdapUser.lastname);

        // # Update LDAP user then sync
        const randomId = getRandomId();
        const newFirstName = `Firstname${randomId}`;
        const newLastName = `Lastname${randomId}`;
        cy.updateLDAPUser({
            ...samlLdapUser,
            firstname: newFirstName,
            lastname: newLastName,
        });
        cy.runLdapSync(admin);

        // # Refresh make sure user not logged out.
        cy.reload();

        // * Check the user settings
        cy.verifyAccountNameSettings(newFirstName, newLastName);
    });
});
