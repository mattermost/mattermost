// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @keyboard_shortcuts

describe('Keyboard Shortcuts', () => {
    before(() => {
        cy.apiInitSetup({loginAfter: true}).then(({channelUrl}) => {
            // # Visit a test channel
            cy.visit(channelUrl);
        });
    });

    it('MM-T1249 CTRL/CMD+SHIFT+L - Set focus to center channel message box (with REPLY RHS open)', () => {
        cy.postMessage('Hello World!');

        cy.getLastPostId().then((postId) => {
            // # Open RHS
            cy.clickPostDotMenu(postId);
            cy.findByText('Reply').click();

            // * Confirm that reply text box has focus
            cy.uiGetReplyTextBox().should('be.focused');

            // * Confirm the RHS is shown
            cy.get('#rhsCloseButton').should('exist');

            // # Press CTRL/CMD+SHIFT+L
            cy.get('body').cmdOrCtrlShortcut('{shift}L');

            // * Confirm the message box has focus
            cy.uiGetPostTextBox().should('be.focused');
        });
    });

    it('MM-T1250 CTRL/CMD+SHIFT+L - Set focus to center channel message box (with SEARCH RHS open)', () => {
        // # Search
        cy.get('#searchBox').click().type('test{enter}');

        // * Wait for the RHS to open and the search results to appear
        cy.contains('.sidebar--right__header', 'Search Results').should('be.visible');

        // # Press CTRL/CMD+SHIFT+L
        cy.get('body').cmdOrCtrlShortcut('{shift}L');

        // * Confirm the message box has focus
        cy.uiGetPostTextBox().should('be.focused');
    });
});
