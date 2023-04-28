// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Group: @not_cloud @messaging @markdown

describe('Messaging', () => {
    before(() => {
        // # Login as test user
        cy.apiInitSetup({loginAfter: true}).then((out) => {
            cy.visit(out.offTopicUrl);
        });
    });

    beforeEach(() => {
        cy.get('.textarea-wrapper').invoke('width').then((width) => {
            // # Get the width of the wrapper
            cy.wrap(width).as('initialPostTextBoxWrapperWidth');
        });
    });

    it('textarea should have width equal to wrapper when show Formatting bar is true', () => {
        // * By Default formatting bar is set to true
        cy.uiGetPostTextBox().invoke('width').then((width) => {
            // # add the padding to textArea width
            cy.get('@initialPostTextBoxWrapperWidth').should('be.equal', width + 64);
        });
    });

    it('textarea should have not width equal to wrapper when show Formatting bar is false', () => {
        // # set the show formatting bar to false
        cy.get('#toggleFormattingBarButton').click();
        cy.uiGetPostTextBox().invoke('width').then((width) => {
            // # add the padding to textArea width
            cy.get('@initialPostTextBoxWrapperWidth').should('be.greaterThan', width + 64);
        });
    });
});
