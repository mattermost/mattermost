// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @messaging

describe('No Matches for Autocomplete', () => {
    before(() => {
        cy.apiInitSetup().then(({team}) => {
            // # Visit town-square
            cy.visit(`/${team.name}/channels/town-square`);
        });
    });

    it('MM-T270 No matches for user autocomplete', () => {
        // # Type non-existent user name
        const nonExistentUser = 'nonExistentUser';
        cy.uiGetPostTextBox().clear().type(`@${nonExistentUser}`);

        // * Verify suggestion list does not exist
        cy.get('#suggestionList').should('not.exist');

        // # Hit enter to post non-existent user name
        cy.uiGetPostTextBox().type('{enter}');

        // * Verify that the last message posted contains the user name and is not linked
        cy.getLastPost().within(() => {
            cy.get(`[data-mention=${nonExistentUser}]`).should('include.text', `@${nonExistentUser}`);
            cy.get('.mention-link').should('not.exist');
        });
    });

    it('MM-T269 No matches for channel autocomplete', () => {
        // # Type non-existent channel name
        const nonExistentChannel = 'nonExistentChannel';
        cy.uiGetPostTextBox().clear().clear().type(`~${nonExistentChannel}`);

        // * Verify suggestion list does not exist
        cy.get('#suggestionList').should('not.exist');

        // # Hit enter to post non-existent channel name
        cy.uiGetPostTextBox().type('{enter}');

        // * Verify that the last message posted contains the channel name and is not linked
        cy.getLastPost().should('include.text', `~${nonExistentChannel}`).within(() => {
            cy.get(`[data-channel-mention=${nonExistentChannel}]`).should('not.exist');
            cy.get('.mention-link').should('not.exist');
        });
    });
});
