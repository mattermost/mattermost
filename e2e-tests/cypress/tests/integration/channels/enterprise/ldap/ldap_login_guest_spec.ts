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
import {disableOnboardingTaskList, removeUserFromAllTeams, setLDAPTestSettings} from './helpers';

describe('LDAP Add Member and Guest to teams and test logins', () => {
    const user1 = ldapUsers['test-1'];
    const guest1 = ldapUsers['board-1'];
    const admin1 = ldapUsers['dev-1'];

    let testSettings;
    let team;

    before(() => {
        // * Check if server has license for LDAP
        cy.apiRequireLicenseForFeature('LDAP');

        // # Test LDAP configuration and server connection
        // # Synchronize user attributes
        cy.apiLDAPTest();
        cy.apiLDAPSync();

        cy.apiGetConfig().then(({config}) => {
            testSettings = setLDAPTestSettings(config);
            testSettings.user = admin1;

            cy.apiCreateTeam().then((out) => {
                team = out.team;
            });

            removeUserFromAllTeams(user1);
            removeUserFromAllTeams(guest1);
            removeUserFromAllTeams(admin1);

            disableOnboardingTaskList(user1);
            disableOnboardingTaskList(guest1);
            disableOnboardingTaskList(admin1);
        });
    });

    beforeEach(() => {
        cy.apiAdminLogin();
    });

    it('Invalid login with guest filter', () => {
        testSettings.user = guest1;
        const ldapSetting = {
            LdapSettings: {
                UserFilter: '(cn=no_users)',
                GuestFilter: '(cn=no_guests)',
            },
        };

        cy.apiUpdateConfig(ldapSetting).then(() => {
            cy.doLDAPLogin(testSettings).then(() => {
                // * Verify login failed
                cy.checkLoginFailed(testSettings);
            });
        });
    });

    // Note: This will fail on second run once LDAP user "test-1" has been added to a channel.
    // Reset to local DB to make it pass again.
    it('LDAP login, new guest, no channels', () => {
        testSettings.user = guest1;
        const ldapSetting = {
            LdapSettings: {
                UserFilter: '(cn=no_users)',
                GuestFilter: '(cn=board*)',
            },
        };

        cy.apiUpdateConfig(ldapSetting).then(() => {
            cy.doLDAPLogin(testSettings).then(() => {
                // # Do logout from sign up
                cy.doLogoutFromSignUp(testSettings);
            });
        });
    });

    it('LDAP Guest login with team invite', () => {
        testSettings.teamName = team.name;
        testSettings.user = guest1;
        const ldapSetting = {
            LdapSettings: {
                GuestFilter: '(cn=board*)',
            },
        };

        cy.apiGetChannelByName(testSettings.teamName, 'town-square').then(({channel}) => {
            cy.apiGetUserByEmail(guest1.email).then(({user}) => {
                cy.apiAddUserToTeam(team.id, user.id).then(() => {
                    cy.apiAddUserToChannel(channel.id, user.id);
                });
            });
        });

        cy.apiUpdateConfig(ldapSetting).then(() => {
            cy.doLDAPLogin(testSettings).then(() => {
                // # Do LDAP logout
                cy.doLDAPLogout(testSettings);
            });
        });
    });
});
