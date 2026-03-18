// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @team_settings

describe('Teams Suite', () => {
    before(() => {
        // # Build data to test and login as team admin
        cy.apiInitSetup().then(({team, user}) => {
            const requiredMembersCount = 60;

            // # Get users not in team and add into the team
            cy.apiGetUsersNotInTeam({teamId: team.id, page: 0, perPage: 200}).then(({users}) => {
                const usersToAdd = users.
                    filter((u) => u.delete_at === 0).
                    slice(0, requiredMembersCount - 3).
                    map((u) => ({team_id: team.id, user_id: u.id}));

                Cypress._.chunk(usersToAdd, 20).forEach((chunk) => {
                    cy.apiAddUsersToTeam(team.id, chunk);
                });
            });

            // # Check number of team members and add if required.
            cy.apiGetTeamMembers(team.id).then(({members}) => {
                if (members.length < requiredMembersCount) {
                    Cypress._.times(requiredMembersCount - members.length, () => {
                        cy.apiCreateUser().then(({user: newUser}) => {
                            cy.apiAddUserToTeam(team.id, newUser.id);
                        });
                    });
                }
            });

            // # Promote user to team admin
            cy.apiUpdateTeamMemberSchemeRole(team.id, user.id, {scheme_admin: true, scheme_user: true});

            // # Login as test user and visit town-square
            cy.apiLogin(user);
            cy.visit(`/${team.name}/channels/town-square`);
        });
    });

    it('MM-T384 Team Admin can use Next button to page through list in Manage Members', () => {
        // # Open team menu and click "Manage Members"
        cy.uiOpenTeamMenu('Manage members');

        // * Check Manage Members modal dialog
        cy.get('#teamMemberModalLabel').should('be.visible');

        // * Check teammate total
        cy.get('#searchableUserListTotal').should('contain', '1 - 50 members of 60 total');

        // # Click Next button
        cy.get('#searchableUserListNextBtn').should('be.visible').click();

        // * Check teammate list advances by one page
        cy.get('#searchableUserListTotal').should('contain', '51 - 60 members of 60 total');

        // # Click Prev button
        cy.get('#searchableUserListPrevBtn').should('be.visible').click();

        // * Check teammate list reverses by one page
        cy.get('#searchableUserListTotal').should('contain', '1 - 50 members of 60 total');
    });
});
