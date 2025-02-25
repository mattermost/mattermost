// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @team_settings

import {
    promoteToChannelOrTeamAdmin,
} from '../enterprise/system_console/channel_moderation/helpers.ts';

describe('Manage Members', () => {
    let testTeam;
    let testUser;

    beforeEach(() => {
        // # Login as sysadmin
        cy.apiAdminLogin();

        // # Login as test user and visit town-square
        cy.apiInitSetup().then(({team, user}) => {
            testTeam = team;
            testUser = user;
        });
    });

    it('MM-T2331 System Admin can promote Member to Team Admin', () => {
        // # Go to Town Square
        cy.visit(`/${testTeam.name}/channels/town-square`);

        // # Open team menu and click 'Manage Members'
        cy.uiOpenTeamMenu('Manage Members');

        // # Open member dropdown
        cy.get(`#teamMembersDropdown_${testUser.username}`).should('be.visible').click();

        // # Click Make Team Admin
        cy.get(`#teamMembersDropdown_${testUser.username} ~ div button:contains(Make Team Admin)`).should('be.visible').click();

        // * Verify dropdown shows that user is now a Team Admin
        cy.get(`#teamMembersDropdown_${testUser.username} span:contains(Team Admin)`).should('be.visible');
    });

    it('MM-T2334 Team Admin can promote Member to Team Admin', () => {
        // # Make the test user a Team Admin
        promoteToChannelOrTeamAdmin(testUser.id, testTeam.id, 'teams');

        // # Create a new user
        cy.apiCreateUser({prefix: 'nonAdminUser'}).then(({user}) => {
            // # Add user to the team
            cy.apiAddUserToTeam(testTeam.id, user.id).then(() => {
                // # Login as new team admin
                cy.apiLogin(testUser);

                // # Go to Town Square
                cy.visit(`/${testTeam.name}/channels/town-square`);

                // # Open team menu and click 'Manage Members'
                cy.uiOpenTeamMenu('Manage Members');

                // # Open member dropdown
                cy.get(`#teamMembersDropdown_${user.username}`).should('be.visible').click();

                // # Click Make Team Admin
                cy.get(`#teamMembersDropdown_${user.username} ~ div button:contains(Make Team Admin)`).should('be.visible').click();

                // * Verify dropdown shows that user is now a Team Admin
                cy.get(`#teamMembersDropdown_${user.username} span:contains(Team Admin)`).should('be.visible');
            });
        });
    });

    it('MM-T2335 Remove a team member and ensure they cannot rejoin if the team is not joinable', () => {
        // # Make the test user a Team Admin
        promoteToChannelOrTeamAdmin(testUser.id, testTeam.id, 'teams');

        // # Create a new user
        cy.apiCreateUser({prefix: 'nonAdminUser'}).then(({user}) => {
            // # Add user to the team
            cy.apiAddUserToTeam(testTeam.id, user.id).then(() => {
                // # Create a second team
                cy.apiCreateTeam('other-team', 'Other Team').then(({team: otherTeam}) => {
                    // # Add user to the other team
                    cy.apiAddUserToTeam(otherTeam.id, user.id).then(() => {
                        // # Login as new team admin
                        cy.apiLogin(testUser);

                        // # Go to Town Square
                        cy.visit(`/${testTeam.name}/channels/town-square`);

                        // # Open team menu and click 'Manage Members'
                        cy.uiOpenTeamMenu('Manage Members');

                        // # Open member dropdown
                        cy.get(`#teamMembersDropdown_${user.username}`).should('be.visible').click();

                        // # Click Remove from Team
                        cy.get(`#teamMembersDropdown_${user.username} ~ div button:contains(Remove from Team)`).should('be.visible').click();

                        // * Verify teammate no longer appears
                        cy.get(`#teamMembersDropdown_${user.username}`).should('not.exist');

                        // # Login as non admin user
                        cy.apiLogin(user);

                        // # Go to team that they are still a member of
                        cy.visit(`/${otherTeam.name}/channels/town-square`);

                        // * Verify they are still a member
                        cy.uiGetLHSHeader().should('contain', otherTeam.display_name);

                        // # Go to team that they were removed from
                        cy.visit(`/${testTeam.name}/channels/town-square`);

                        // * Verify that they get a 'Team Not Found' screen
                        cy.url().should('include', '/error?type=team_not_found');
                    });
                });
            });
        });
    });

    it('MM-T2338 Remove a team member and ensure they can rejoin with invite link', () => {
        promoteToChannelOrTeamAdmin(testUser.id, testTeam.id, 'teams');

        // # Create a new user
        cy.apiCreateUser({prefix: 'nonAdminUser'}).then(({user}) => {
            // # Add user to the team
            cy.apiAddUserToTeam(testTeam.id, user.id).then(() => {
                // # Login as new team admin
                cy.apiLogin(testUser);

                // # Go to Town Square
                cy.visit(`/${testTeam.name}/channels/town-square`);

                // # Open team menu and click 'Manage Members'
                cy.uiOpenTeamMenu('Manage Members');

                // # Open member dropdown
                cy.get(`#teamMembersDropdown_${user.username}`).should('be.visible').click();

                // # Click Remove from Team
                cy.get(`#teamMembersDropdown_${user.username} ~ div button:contains(Remove from Team)`).should('be.visible').click();

                // * Verify teammate no longer appears
                cy.get(`#teamMembersDropdown_${user.username}`).should('not.exist');

                // # Close the modal
                cy.get('#teamMembersModal').find('button.close').should('be.visible').click();

                // # Get the invite link
                cy.getInvitePeopleLink({user: testUser}).then((inviteLink) => {
                    // # Login as non admin user
                    cy.apiLogin(user);

                    // # Go to team that they were removed from
                    cy.visit(`/${testTeam.name}/channels/town-square`);

                    // * Verify that they get a 'Team Not Found' screen
                    cy.url().should('include', '/error?type=team_not_found');

                    // # Go to the invite link
                    cy.visit(inviteLink);

                    // * Verify that the user has rejoined the team
                    cy.uiGetLHSHeader().should('contain', testTeam.display_name);
                });
            });
        });
    });
});
