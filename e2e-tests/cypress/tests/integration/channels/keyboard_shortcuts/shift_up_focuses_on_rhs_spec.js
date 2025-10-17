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
            // # Visit a test channel
            cy.visit(offTopicUrl);
            cy.postMessage('Hello World');
        });
    });

    it('MM-T1277 SHIFT+UP', () => {
        // # Press shift+up to open the latest thread in the channel in the RHS
        cy.uiGetPostTextBox().type('{shift+uparrow}', {delay: 50});

        // * RHS Opens up
        cy.get('.sidebar--right__header').should('be.visible');

        // * RHS textbox should be focused
        cy.uiGetReplyTextBox().should('be.focused');

        // # Click into the post textbox in the center channel
        cy.uiGetPostTextBox().click();

        // # Press shift+up again
        cy.uiGetPostTextBox().type('{shift+uparrow}', {delay: 50});

        // * RHS textbox should be focused
        cy.uiGetReplyTextBox().should('be.focused');

        // # Post a reply in the thread
        cy.uiGetReplyTextBox().type('This is a reply{enter}');

        // # Close the RHS by clicking the X button
        cy.get('#rhsCloseButton').click();

        // * Verify RHS is closed
        cy.get('.sidebar--right__header').should('not.exist');

        // # Click into the center channel post textbox
        cy.uiGetPostTextBox().click();

        // # Press shift+up to open the thread with replies
        cy.uiGetPostTextBox().type('{shift+uparrow}', {delay: 50});

        // * RHS Opens up
        cy.get('.sidebar--right__header').should('be.visible');

        // * RHS textbox should be focused
        cy.uiGetReplyTextBox().should('be.focused');
    });
});
