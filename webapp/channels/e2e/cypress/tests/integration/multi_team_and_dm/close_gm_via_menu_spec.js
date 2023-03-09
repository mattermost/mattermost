// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @multi_team_and_dm

describe('Multi-user group messages', () => {
    let testUser;
    let testTeam;
    before(() => {
        // # Create a new team
        cy.apiInitSetup().then(({team, user}) => {
            testUser = user;
            testTeam = team;

            // # Add 3 users to the team
            Cypress._.times(3, () => createUserAndAddToTeam(testTeam));
        });
    });

    it('MM-T1799 Should Close Group Message from channel menu', () => {
        // # Login as test user
        cy.apiLogin(testUser);

        // # Go to town-square channel
        cy.visit(`/${testTeam.name}/channels/town-square`);

        // # Open the 'Direct messages' dialog to create a new direct message
        cy.uiAddDirectMessage().should('be.visible').click();

        // # Add 3 users to a group message
        addUsersToGMViaModal(3);

        // * Check that the list is populated
        cy.get('.react-select__multi-value').should('have.length', 3);

        // # Click on "Go" in the group message's dialog to begin the conversation
        cy.get('#saveItems').click();

        // # Click channel dropdown icon to open menu
        cy.get('#channelHeaderDropdownIcon').click();

        // # Click 'close' item
        cy.findByText('Close Group Message').should('be.visible').click();

        // * Validate that GM is closed and we are redirected
        expectActiveChannelToBe('Town Square', '/town-square');
    });
});

// Helper functions

const expectActiveChannelToBe = (title, url) => {
    // * Expect channel title to match title passed in argument
    cy.get('#channelHeaderTitle').
        should('be.visible').
        and('contain.text', title);

    // * Expect url to match url passed in argument
    cy.url().should('contain', url);
};

const createUserAndAddToTeam = (team) => {
    cy.apiCreateUser({prefix: 'gm'}).then(({user}) =>
        cy.apiAddUserToTeam(team.id, user.id),
    );
};

/**
 * Add a given amount of numbers to a direct message group
 * @param {number} userCountToAdd
 */
const addUsersToGMViaModal = (userCountToAdd) => {
    // # Ensure there are enough selectable users in the list
    cy.get('#multiSelectList').
        should('be.visible').
        children().
        should('have.length.gte', userCountToAdd);

    // # Add the first user from the top of the list, as many times as requested by 'userCountToAdd'
    Cypress._.times(userCountToAdd, () => {
        cy.get('#multiSelectList').
            children().
            first().
            click();
    });
};
