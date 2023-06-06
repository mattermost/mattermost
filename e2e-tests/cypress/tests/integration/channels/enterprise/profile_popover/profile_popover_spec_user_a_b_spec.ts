// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @enterprise @profile_popover

describe('Profile popover User A & B', () => {
    let testTeam: Cypress.Team;
    let testUser: Cypress.UserProfile;
    let otherUser: Cypress.UserProfile;

    before(() => {
        cy.apiRequireLicense();
        cy.apiInitSetup().then(({team, user}) => {
            testTeam = team;
            testUser = user;

            cy.apiCreateUser().then(({user: secondUser}) => {
                otherUser = secondUser;
                cy.apiAddUserToTeam(testTeam.id, secondUser.id);
            });

            // # Remove the user from the team
            cy.removeUserFromTeam(testTeam.id, testUser.id);
        });
    });

    beforeEach(() => {
        cy.apiAdminLogin();
        cy.apiResetRoles();
    });

    it('MM-T5 User A & User B (removed from team)', () => {
        // # Login as the other user
        cy.apiLogin(otherUser);
        cy.visit(`/${testTeam.name}/channels/off-topic`);

        // # @ mention the kicked out user
        cy.postMessage(`Hi there @${testUser.username} `);

        // # Click on the @ mention
        cy.getLastPostId().then((postId) => {
            cy.get(`#postMessageText_${postId}`).
                find(`[data-mention=${testUser.username}]`).
                should('be.visible').
                click();
        });

        // * Add to a Channel should not be shown.
        cy.findByText('Add to a Channel').should('not.exist');
    });

    it('MM-T8 Add User - UserA & UserB (not on team)', () => {
        // # Create a new team
        cy.apiCreateTeam('team', 'Test NoMember').then(({team}) => {
            cy.apiAddUserToTeam(team.id, testUser.id);

            // # Login as testuser
            cy.apiLogin(testUser);

            // # Visit off-topic
            cy.visit(`/${team.name}/channels/off-topic`);

            // # @ mention the kicked out user
            cy.postMessage(`Hi there @${otherUser.username} `);

            // # Click on the @ mention
            cy.getLastPostId().then((postId) => {
                cy.get(`#postMessageText_${postId}`).
                    find(`[data-mention=${otherUser.username}]`).
                    should('be.visible').
                    click();
                cy.get('#user-profile-popover').should('be.visible');
            });

            // # Add to a Channel should not be shown.
            cy.findByText('Add to a Channel').should('not.exist');
        });
    });
});
