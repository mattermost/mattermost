// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. #. Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @enterprise @ldap

// Assumes the CYPRESS_* variables are set
// Assumes that E20 license is uploaded
// For setup with AWS: Follow the instructions mentioned in the mattermost/platform-private/config/ldap-test-setup.txt file

import ldapUsers from '../../../../fixtures/ldap_users.json';
import {getRandomId} from '../../../../utils';
import {disableOnboardingTaskList, removeUserFromAllTeams, setLDAPTestSettings} from './helpers';

describe('LDAP Login flow - Admin Login', () => {
    const user1 = ldapUsers['test-1'];
    const guest1 = ldapUsers['board-1'];
    const admin1 = ldapUsers['dev-1'];

    let testSettings;

    before(() => {
        // * Check if server has license for LDAP
        cy.apiRequireLicenseForFeature('LDAP');

        // # Test LDAP configuration and server connection
        // # Synchronize user attributes
        cy.apiLDAPTest();
        cy.apiLDAPSync();

        cy.apiGetConfig().then(({config}) => {
            testSettings = setLDAPTestSettings(config);
        });

        removeUserFromAllTeams(user1);
        removeUserFromAllTeams(guest1);
        removeUserFromAllTeams(admin1);

        disableOnboardingTaskList(user1);
        disableOnboardingTaskList(guest1);
        disableOnboardingTaskList(admin1);

        cy.apiAdminLogin();
    });

    it('MM-T2821 LDAP Admin Filter', () => {
        testSettings.user = admin1;
        const ldapSetting = {
            LdapSettings: {
                EnableAdminFilter: true,
                AdminFilter: '(cn=dev*)',
            },
        };
        cy.apiUpdateConfig(ldapSetting).then(() => {
            cy.doLDAPLogin(testSettings).then(() => {
                // # Skip or create team
                cy.skipOrCreateTeam(testSettings, getRandomId()).then(() => {
                    cy.uiGetLHSHeader().then((teamName) => {
                        testSettings.teamName = teamName.text();
                    });

                    // # Do LDAP logout
                    cy.doLDAPLogout(testSettings);
                });
            });
        });
    });

    it('LDAP login existing MM admin', () => {
        // existing user, verify and logout
        cy.doLDAPLogin(testSettings).then(() => {
            // # Do LDAP logout
            cy.doLDAPLogout(testSettings);
        });
    });
});
