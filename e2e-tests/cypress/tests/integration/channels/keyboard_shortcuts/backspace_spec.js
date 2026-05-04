// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @keyboard_shortcuts

describe('Keyboard Shortcuts', () => {
    let testUser;
    let testTeam;
    let publicChannel;

    before(() => {
        cy.apiInitSetup({loginAfter: true}).then(({team, channel, user}) => {
            // # Visit a test channel
            testTeam = team;
            publicChannel = channel;
            testUser = user;

            cy.visit(`/${team.name}/channels/${channel.name}`);
        });
    });

    it('MM-T3421 - Pressing the backspace key without an input focused should not send the browser back in history', () => {
        // # Navigate to a couple of pages
        cy.visit(`/${testTeam.name}/channels/town-square`);
        cy.visit(`/${testTeam.name}/channels/off-topic`);
        cy.visit(`/${testTeam.name}/channels/${publicChannel.name}`);
        cy.visit(`/${testTeam.name}/channels/off-topic`);

        // # Visit a DM URL
        cy.visit(`/${testTeam.name}/messages/@${testUser.username}`);
        cy.url().should('include', `/${testTeam.name}/messages/@${testUser.username}`);

        // # Type/edit some text and remove focus from the input field
        cy.uiGetPostTextBox().clear().type('This is a normal sentence.').type('{backspace}{backspace}').blur();

        // * Verify that the backspace key presses modified the input correctly
        cy.uiGetPostTextBox().should('have.value', 'This is a normal sentenc');

        // # Select the body to remove focus from the input field
        cy.get('body').type('{backspace}');
        cy.get('body').type('{backspace}');

        // * Verify that the additional backspace key presses on blur doesn't affect the input
        cy.uiGetPostTextBox().should('have.value', 'This is a normal sentenc');

        // * Verify that the URL doesn't change from the last URL
        cy.url().should('include', `/${testTeam.name}/messages/@${testUser.username}`);
    });
});
