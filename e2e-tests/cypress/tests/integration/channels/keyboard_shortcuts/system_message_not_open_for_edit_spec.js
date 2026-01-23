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
    before(() => {
        cy.apiInitSetup({loginAfter: true}).then(({offTopicUrl}) => {
            // # Visit off-topic channel
            cy.visit(offTopicUrl);
        });
    });

    it('MM-T1265 UP - System message does not open for edit; opens previous regular message', () => {
        const message = 'Test message';
        const newHeader = 'New Header';

        // # Post message in the channel from User
        cy.postMessage(message);

        // # Open the edit the channel header modal
        cy.get('[aria-label="Set header"]').click();

        // * Verify modal is open
        cy.findByRole('dialog', {name: 'Edit Header for Off-Topic'}).within(() => {
            // # Enter new header and save
            cy.findByRole('textbox', {name: 'Edit the text appearing next to the channel name in the header.'}).type(newHeader);
            cy.uiSave();
        });

        // * Wait for the system message to be posted
        cy.uiWaitUntilMessagePostedIncludes(newHeader);

        // # Press UP arrow
        cy.findByTestId('post_textbox').
            type('{uparrow}');

        // * Verify that the Edit Post Input is visible
        cy.get('#edit_textbox').
            should('be.visible').
            should('have.text', message);
    });
});
