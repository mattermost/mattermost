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

// Group: @enterprise @ldap @saml @keycloak

import {getAdminAccount} from '../../support/env';
import {generateLDAPUser} from '../../support/ldap_server_commands';
import {getKeycloakServerSettings} from '../../utils/config';

describe('AD / LDAP', () => {
    const nonLDAPUser = generateLDAPUser();

    let samlLdapUser;
    let testTeamId;

    before(() => {
        cy.createLDAPUser().then((user) => {
            samlLdapUser = user;
        });

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

        const samlConfig = getKeycloakServerSettings();
        cy.apiUpdateConfig(samlConfig).then(() => {
            // # Require keycloak with realm setup
            cy.apiRequireKeycloak();

            // # Upload certificate, overwrite existing
            cy.apiUploadSAMLIDPCert('keycloak.crt');

            // # Create Keycloak user and login for the first time
            cy.keycloakCreateUsers([samlLdapUser, nonLDAPUser]);

            cy.doKeycloakLogin(samlLdapUser);

            // # Wait for the UI to be ready which indicates SAML registration is complete
            cy.findByText('Logout').click();
        });
    });

    it('MM-T3664 - SAML User, Not in LDAP', () => {
        // # Login to Keycloak
        cy.doKeycloakLogin(nonLDAPUser);

        // * Should render an error since user is not registered in LDAP
        cy.findByText('User not registered on AD/LDAP server.');

        // # Run LDAP Sync
        const admin = getAdminAccount();
        cy.runLdapSync(admin);

        // # REgister as LDAP user
        cy.createLDAPUser({user: nonLDAPUser});

        // # Add user to team
        cy.apiAdminLogin();
        cy.apiGetUserByEmail(nonLDAPUser.email).then(({user}) => {
            cy.apiAddUserToTeam(testTeamId, user.id);
        });

        // # Login to Keycloak
        cy.doKeycloakLogin(nonLDAPUser);

        // * Should successfully login and view the default channel
        cy.postMessage('hello');

        // * Check user setting is in sync with LDAP
        cy.verifyAccountNameSettings(nonLDAPUser.firstname, nonLDAPUser.lastname);
    });

    it('MM-T3665 - Deactivate user in SAML', () => {
        // # Add user to team
        cy.apiAdminLogin();
        cy.apiGetUserByEmail(samlLdapUser.email).then(({user}) => {
            cy.apiAddUserToTeam(testTeamId, user.id);
        });

        // # Login to Keycloak
        cy.doKeycloakLogin(samlLdapUser);

        // * Should successfully login and view the default channel
        cy.postMessage('hello');

        // # Suspend Keycloak user
        cy.keycloakSuspendUser(samlLdapUser.email);

        // # Login to Keycloak
        cy.doKeycloakLogin(samlLdapUser);

        // * Verify login failed
        cy.verifyKeycloakLoginFailed();

        // # Activate user in keycloak
        cy.keycloakUnsuspendUser(samlLdapUser.email);

        // # Login again
        cy.findByText('Password').type(samlLdapUser.password);
        cy.findAllByText('Log In').last().click();

        // * Should successfully login and view the default channel
        cy.postMessage('hello');

        // * Check the user settings
        cy.verifyAccountNameSettings(samlLdapUser.firstname, samlLdapUser.lastname);
    });
});
