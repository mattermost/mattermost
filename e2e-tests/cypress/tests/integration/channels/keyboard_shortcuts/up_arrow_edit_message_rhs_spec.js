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
        cy.apiInitSetup({loginAfter: true}).then(({channelUrl}) => {
            // # Visit a test channel
            cy.visit(channelUrl);
        });
    });

    it('MM-T1261 UP arrow', () => {
        cy.postMessage('Hello World');

        cy.getLastPostId().then((postId) => {
            // # Add a reply message, to have RHS container open
            cy.clickPostDotMenu(postId);
            cy.findByText('Reply').click();
            const replyMessage = 'Well, hello there.';
            cy.uiGetReplyTextBox().type(replyMessage, {delay: 100});
            cy.uiGetReplyTextBox().type('{enter}');
            cy.uiWaitUntilMessagePostedIncludes(replyMessage);

            // # Press up arrow key
            cy.get('body').type('{uparrow}');

            // * Verify that the Edit Post Input is visible
            cy.get('#edit_textbox').should('be.visible');

            // * Verify that edit box have value of edited message
            cy.get('#edit_textbox').should('have.value', replyMessage);
        });
    });
});
