// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Group: @channels @multi_team_and_dm

describe('Multi-user group messages', () => {
    let testUser;
    let testTeam;
    before(() => {
        // # Create a new team
        cy.apiInitSetup().then(({team, user}) => {
            testUser = user;
            testTeam = team;

            // # Add 10 users to the team
            Cypress._.times(10, () => createUserAndAddToTeam(testTeam));
        });
    });

    it('MM-T463 Should not be able to create a group message with more than 8 users', () => {
        // # Login as test user
        cy.apiLogin(testUser);

        // # Go to town-square channel
        cy.visit(`/${testTeam.name}/channels/town-square`);

        // # Open the 'Direct messages' dialog to create a new direct message
        cy.uiAddDirectMessage().click();

        // # Add the maximum amount of users to a group message (7)
        addUsersToGMViaModal(7);

        // * Check that the user count in the group message modal equals 7
        cy.get('.react-select__multi-value').should('have.length', 7);

        expectCannotAddUsersMessage(0);

        // # Try to add one more user
        addUsersToGMViaModal(1);

        // * Check that the list of users in the multi-select is still 7
        cy.get('.react-select__multi-value').should('have.length', 7);

        // # Click on "Go" in the group message's dialog to begin the conversation
        cy.get('#saveItems').click();

        // * Check that the number of users in the group message is 8
        cy.get('#channelMemberCountText').
            should('be.visible').
            and('have.text', '8');

        // * Check that the direct message text input's placeholder is truncated if the user's list is too long
        cy.get('[data-testid="post_textbox_placeholder"]').
            should('be.visible').
            and('have.css', 'overflow', 'hidden').
            and('have.css', 'text-overflow', 'ellipsis');

        // # From the group message's window, click on the user list's dropdown
        cy.get('#channelHeaderDropdownIcon').click();

        // # From the dropdown menu, click on "Add members"
        cy.get('#channelAddMembers').click();

        // # Try to add one more user from the group message's list
        addUsersToGMViaModal(1);

        // # Check that the appropriate information & warnings are displayed in the group message's dialog
        expectCannotAddUsersMessage(0);

        // * Check that the count of selected number of users in the group message's dialog is 7
        cy.get('.react-select__multi-value').
            should('be.visible').
            and('have.length', 7);

        // # Remove the last user from the group message's dialog input section
        cy.get('.react-select__multi-value__remove').
            should('be.visible').
            and('have.length', 7).
            last().
            click();

        // # Check that the appropriate information & warnings are displayed in the group message's dialog
        expectCannotAddUsersMessage(1);
    });
});

// Helper functions

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

/**
 * In the "Direct messages" dialog, assert against help section that appropriate messages are displayed
 *  - The number of people that still can be added to the group message
 *  - The information message advising to start a private channel when the maximum number of users is reached (if applicable)
 * @param {number} expectedUsersLeftToAdd
 */
const expectCannotAddUsersMessage = (expectedUsersLeftToAdd) => {
    const maxUsersGMNote = "You've reached the maximum number of people for this conversation. Consider creating a private channel instead.";

    // * Check that the help section indicates we cannot add anymore users
    cy.get('#multiSelectHelpMemberInfo').
        should('be.visible').
        and('contain.text', `You can add ${expectedUsersLeftToAdd} more ${expectedUsersLeftToAdd === 1 ? 'person' : 'people'}`);

    if (expectedUsersLeftToAdd === 0) {
        // * Check that a note in the help section suggests creating a private channel instead
        cy.get('#multiSelectMessageNote').should('contain.text', maxUsersGMNote);
    }
};
