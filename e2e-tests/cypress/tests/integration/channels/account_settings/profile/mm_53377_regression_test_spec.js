// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. #. Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Group: @channels

describe('MM-53377 Regression tests', () => {
    let testTeam;
    let testUser;
    let testUser2;

    before(() => {
        cy.apiUpdateConfig({
            PrivacySettings: {
                ShowEmailAddress: false,
                ShowFullName: false,
            },
        });

        cy.apiInitSetup().then(({team, user, offTopicUrl}) => {
            testTeam = team;
            testUser = user;

            cy.apiCreateUser().then((payload) => {
                testUser2 = payload.user;
                cy.apiAddUserToTeam(testTeam.id, payload.user.id);
            });

            cy.visit(offTopicUrl);
        });
    });

    beforeEach(() => {
        // # Login as testUser
        cy.apiLogin(testUser);
    });

    it('should still have your email loaded after using the at-mention autocomplete', () => {
        // * Ensure that this user is not an admin
        cy.wrap(testUser).its('roles').should('equal', 'system_user');

        // # Send a couple at mentions, quickly enough that the at mention autocomplete won't appear
        cy.uiPostMessageQuickly(`@${testUser.username} @${testUser2.username}`);

        // # Open the profile popover for the current user
        cy.contains('.mention-link', `@${testUser.username}`).click();

        // * Ensure that all fields are visible for the current user
        cy.get('#user-profile-popover').within(() => {
            cy.findByText(`@${testUser.username}`).should('exist');
            cy.findByText(`${testUser.first_name} ${testUser.last_name}`).should('exist');
            cy.findByText(testUser.email).should('exist');
        });

        // # Click anywhere to close profile popover
        cy.get('#channelHeaderInfo').click();

        // # Open the profile popover for another user
        cy.contains('.mention-link', `@${testUser2.username}`).click();

        // * Ensure that only the username is visible for another user
        cy.get('#user-profile-popover').within(() => {
            cy.findByText(`@${testUser2.username}`).should('exist');
            cy.findByText(`${testUser2.first_name} ${testUser2.last_name}`).should('not.exist');
            cy.findByText(testUser2.email).should('not.exist');
        });

        // # Start to type another at mention so that the autocomplete loads
        cy.get('#post_textbox').type(`@${testUser.username}`);

        // # Wait for the autocomplete to appear with the current user in it
        cy.get('.suggestion-list').within(() => {
            cy.findByText(`@${testUser.username}`);
        });

        // # Clear the post textbox to hide the autocomplete
        cy.get('#post_textbox').clear();

        // # Open the profile popover for the current user again
        cy.contains('.mention-link', `@${testUser.username}`).click();

        // * Ensure that all fields are still visible for the current user
        cy.get('#user-profile-popover').within(() => {
            cy.findByText(`@${testUser.username}`).should('exist');
            cy.findByText(`${testUser.first_name} ${testUser.last_name}`).should('exist');
            cy.findByText(testUser.email).should('exist');
        });
    });
});
