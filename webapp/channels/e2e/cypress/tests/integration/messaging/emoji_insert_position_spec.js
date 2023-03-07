// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// [#] indicates a test step (e.g. # Go to a page)
// [*] indicates an assertion (e.g. * Check the title)
// Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @messaging

describe('Messaging', () => {
    before(() => {
        // # Login as test user and visit off-topic
        cy.apiInitSetup({loginAfter: true}).then(({offTopicUrl}) => {
            cy.visit(offTopicUrl);
        });
    });

    it('MM-T95 Selecting an emoji from emoji picker should insert it at the cursor position', () => {
        // # Write some text in the send box.
        cy.uiGetPostTextBox().type('HelloWorld!');

        // # Move the cursor to the middle of the text.
        cy.uiGetPostTextBox().type('{leftarrow}{leftarrow}{leftarrow}{leftarrow}{leftarrow}{leftarrow}');

        // # Open emoji picker
        cy.uiOpenEmojiPicker();

        // # Select the grinning emoji from the emoji picker.
        cy.clickEmojiInEmojiPicker('grinning');

        // * The emoji should be inserted where the cursor is at the time of selection.
        cy.uiGetPostTextBox().should('have.value', 'Hello :grinning: World!');
        cy.uiGetPostTextBox().type('{enter}');

        // * The emoji should be displayed in the post at the position inserted.
        cy.getLastPost().find('p').should('have.html', `Hello <span data-emoticon="grinning"><span alt=":grinning:" class="emoticon" title=":grinning:" style="background-image: url(&quot;${Cypress.config('baseUrl')}/static/emoji/1f600.png&quot;);">:grinning:</span></span> World!`);
    });
});
