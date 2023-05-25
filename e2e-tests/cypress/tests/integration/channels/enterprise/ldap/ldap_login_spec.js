// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. #. Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @enterprise @ldap

import ldapUsers from '../../../../fixtures/ldap_users.json';
import {getRandomId} from '../../../../utils';

// assumes the CYPRESS_* variables are set
// assumes that E20 license is uploaded
// for setup with AWS: Follow the instructions mentioned in the mattermost/platform-private/config/ldap-test-setup.txt file
context('ldap', () => {
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

    describe('LDAP Login flow - Admin Login', () => {
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

    describe('LDAP Login flow - Member Login)', () => {
        it('Invalid login with user filter', () => {
            testSettings.user = user1;
            const ldapSetting = {
                LdapSettings: {
                    UserFilter: '(cn=no_users)',
                },
            };
            cy.apiAdminLogin().then(() => {
                cy.apiUpdateConfig(ldapSetting).then(() => {
                    cy.doLDAPLogin(testSettings).then(() => {
                        // * Verify login failed
                        cy.checkLoginFailed(testSettings);
                    });
                });
            });
        });

        it('LDAP login, new MM user, no channels', () => {
            testSettings.user = user1;
            const ldapSetting = {
                LdapSettings: {
                    UserFilter: '(cn=test*)',
                },
            };
            cy.apiAdminLogin().then(() => {
                cy.apiUpdateConfig(ldapSetting).then(() => {
                    cy.doLDAPLogin(testSettings).then(() => {
                        // # Do member logout from sign up
                        cy.doMemberLogoutFromSignUp(testSettings);
                    });
                });
            });
        });
    });

    describe('LDAP Login flow - Guest Login', () => {
        it('Invalid login with guest filter', () => {
            testSettings.user = guest1;
            const ldapSetting = {
                LdapSettings: {
                    UserFilter: '(cn=no_users)',
                    GuestFilter: '(cn=no_guests)',
                },
            };
            cy.apiAdminLogin().then(() => {
                cy.apiUpdateConfig(ldapSetting).then(() => {
                    cy.doLDAPLogin(testSettings).then(() => {
                        // * Verify login failed
                        cy.checkLoginFailed(testSettings);
                    });
                });
            });
        });

        it('LDAP login, new guest, no channels', () => {
            testSettings.user = guest1;
            const ldapSetting = {
                LdapSettings: {
                    UserFilter: '(cn=no_users)',
                    GuestFilter: '(cn=board*)',
                },
            };
            cy.apiAdminLogin().then(() => {
                cy.apiUpdateConfig(ldapSetting).then(() => {
                    cy.doLDAPLogin(testSettings).then(() => {
                        // # Do logout from sign up
                        cy.doLogoutFromSignUp(testSettings);
                    });
                });
            });
        });
    });

    describe('LDAP Add Member and Guest to teams and test logins', () => {
        before(() => {
            cy.apiAdminLogin();

            cy.apiGetTeamByName(testSettings.teamName).then(({team}) => {
                cy.apiGetChannelByName(testSettings.teamName, 'town-square').then(({channel}) => {
                    cy.apiGetUserByEmail(guest1.email).then(({user}) => {
                        cy.apiAddUserToTeam(team.id, user.id).then(() => {
                            cy.apiAddUserToChannel(channel.id, user.id);
                        });
                    });

                    // add member user to team
                    cy.apiGetUserByEmail(user1.email).then(({user}) => {
                        cy.apiAddUserToTeam(team.id, user.id);
                    });
                });
            });
        });

        it('LDAP Member login with team invite', () => {
            testSettings.user = user1;
            const ldapSetting = {
                LdapSettings: {
                    UserFilter: '(cn=test*)',
                },
            };
            cy.apiAdminLogin().then(() => {
                cy.apiUpdateConfig(ldapSetting).then(() => {
                    cy.doLDAPLogin(testSettings).then(() => {
                        // # Do LDAP logout
                        cy.doLDAPLogout(testSettings);
                    });
                });
            });
        });

        it('LDAP Guest login with team invite', () => {
            testSettings.user = guest1;
            const ldapSetting = {
                LdapSettings: {
                    GuestFilter: '(cn=board*)',
                },
            };
            cy.apiAdminLogin().then(() => {
                cy.apiUpdateConfig(ldapSetting).then(() => {
                    cy.doLDAPLogin(testSettings).then(() => {
                        // # Do LDAP logout
                        cy.doLDAPLogout(testSettings);
                    });
                });
            });
        });
    });
});

function setLDAPTestSettings(config) {
    return {
        siteName: config.TeamSettings.SiteName,
        siteUrl: config.ServiceSettings.SiteURL,
        teamName: '',
        user: null,
    };
}

function disableOnboardingTaskList(ldapLogin) {
    cy.apiLogin(ldapLogin).then(({user}) => {
        cy.apiSaveOnboardingTaskListPreference(user.id, 'onboarding_task_list_open', 'false');
        cy.apiSaveOnboardingTaskListPreference(user.id, 'onboarding_task_list_show', 'false');
        cy.apiSaveSkipStepsPreference(user.id, 'true');
    });
}

function removeUserFromAllTeams(testUser) {
    cy.apiGetUsersByUsernames([testUser.username]).then(({users}) => {
        users.forEach((user) => {
            cy.apiGetTeamsForUser(user.id).then(({teams}) => {
                teams.forEach((team) => {
                    cy.apiDeleteUserFromTeam(team.id, user.id);
                });
            });
        });
    });
}
