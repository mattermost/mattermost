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
import {getRandomId} from '../../utils';
import {getKeycloakServerSettings} from '../../utils/config';

describe('AD / LDAP', () => {
    let samlLdapUser;
    let testTeamId;

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

        const samlConfig = getKeycloakServerSettings();
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
        });
    });

    beforeEach(() => {
        cy.apiAdminLogin();
        cy.apiGetUserByEmail(samlLdapUser.email).then(({user}) => {
            cy.apiAddUserToTeam(testTeamId, user.id);
            cy.apiRevokeUserSessions(user.id);
        });
    });

    it('MM-T3666 - SAML / LDAP sync with ID Attribute', () => {
        // # Login via Keycloak
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
        const admin = getAdminAccount();
        cy.runLdapSync(admin);

        // # Reload the page
        cy.reload();

        // * Check the user settings is in sync with the new attributes
        cy.verifyAccountNameSettings(newFirstName, newLastName);
    });
});
