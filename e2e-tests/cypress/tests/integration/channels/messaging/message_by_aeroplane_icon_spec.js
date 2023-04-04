// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @messaging @markdown

describe('Messaging', () => {
    before(() => {
        // # resize window to mobile view
        cy.viewport('iphone-6');

        // # Login as test user and visit off-topic
        cy.apiInitSetup({loginAfter: true}).then(({offTopicUrl}) => {
            cy.visit(offTopicUrl);
        });
    });

    it('MM-T73 Mobile view: Clicking on airplane icon does not open file attachment modal but sends the message', () => {
        // # type some characters in the message box
        const message = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. ';
        cy.uiGetPostTextBox().clear().type(message);

        // # click send
        cy.findByTestId('SendMessageButton').click();

        // # check if message sent correctly
        cy.getLastPostId().then((postId) => {
            cy.get(`#postMessageText_${postId}`).should('be.visible').and('have.text', message);
        });

        // # attachment modal does not show up
        cy.get('.a11y__popup').should('not.exist');
    });
});
