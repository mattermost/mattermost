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

// Group: @channels @enterprise @not_cloud @extend_session @ldap @saml @keycloak

import {getKeycloakServerSettings} from '../../../../../utils/config';

import {verifyExtendedSession, verifyNotExtendedSession} from './helpers';

describe('Extended Session Length', () => {
    const sessionLengthInDays = 1;
    const samlConfig = getKeycloakServerSettings();
    const sessionConfig = {
        ServiceSettings: {
            SessionLengthSSOInDays: sessionLengthInDays,
        },
    };

    let testTeamId;
    let testSamlUser;
    let offTopicUrl;
    let samlLdapUser;

    before(() => {
        cy.shouldNotRunOnCloudEdition();
        cy.apiRequireLicenseForFeature('LDAP', 'SAML');

        // * Server database should match with the DB client and config at "cypress.json"
        cy.apiRequireServerDBToMatch();

        // # Create new LDAP user
        cy.createLDAPUser().then((user) => {
            samlLdapUser = user;
        });

        // # Create new team
        cy.apiCreateTeam('saml-team', 'SAML Team').then(({team}) => {
            testTeamId = team.id;
            offTopicUrl = `/${team.name}/channels/off-topic`;
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
        });
    });

    beforeEach(() => {
        cy.apiAdminLogin();
        cy.apiGetUserByEmail(samlLdapUser.email).then(({user}) => {
            testSamlUser = user;
            cy.apiAddUserToTeam(testTeamId, user.id);
            cy.apiRevokeUserSessions(user.id);
        });
    });

    it('MM-T4047_1 SAML/SSO user session should have extended due to user activity when enabled', () => {
        // # Enable ExtendSessionLengthWithActivity
        sessionConfig.ServiceSettings.ExtendSessionLengthWithActivity = true;
        cy.apiUpdateConfig({...samlConfig, ...sessionConfig});

        // # Login via Keycloak
        cy.doKeycloakLogin(samlLdapUser);
        cy.postMessage('hello');

        // # Verify session is extended
        verifyExtendedSession(testSamlUser, sessionLengthInDays, offTopicUrl);
    });

    it('MM-T4047_2 SAML/SSO user session should not extend even with user activity when disabled', () => {
        // # Disable ExtendSessionLengthWithActivity
        sessionConfig.ServiceSettings.ExtendSessionLengthWithActivity = false;
        cy.apiUpdateConfig({...samlConfig, ...sessionConfig});

        // # Login via Keycloak
        cy.doKeycloakLogin(samlLdapUser);
        cy.postMessage('hello');

        // # Verify session is not extended
        verifyNotExtendedSession(testSamlUser, offTopicUrl);
    });
});
