// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @messaging

import * as TIMEOUTS from '../../fixtures/timeouts';

describe('Edit Message', () => {
    let offTopicUrl;

    before(() => {
        // # Login as test user
        cy.apiInitSetup({loginAfter: true}).then((out) => {
            offTopicUrl = out.offTopicUrl;
        });
    });

    beforeEach(() => {
        // # Visit town-square
        cy.visit(offTopicUrl);
    });

    it('MM-T121 Escape should not close modal when an autocomplete drop down is in use', () => {
        // # Post a message
        cy.postMessage('Hello World!');

        // # Hit the up arrow to open the "edit modal"
        cy.uiGetPostTextBox().type('{uparrow}');

        // # In the modal type @
        cy.get('#edit_textbox').type(' @');

        // * Assert user autocomplete is visible
        cy.get('#suggestionList').should('be.visible');

        // # Press the escape key
        cy.get('#edit_textbox').wait(TIMEOUTS.HALF_SEC).focus().type('{esc}');

        // * Check if the textbox contains expected text
        cy.get('#edit_textbox').should('have.value', 'Hello World! @');

        // * Assert user autocomplete is not visible
        cy.get('#suggestionList').should('not.exist');

        // # In the modal type ~
        cy.get('#edit_textbox').type(' ~');

        // * Assert channel autocomplete is visible
        cy.get('#suggestionList').should('be.visible');

        // # Press the escape key
        cy.get('#edit_textbox').wait(TIMEOUTS.HALF_SEC).type('{esc}');

        // * Check if the textbox contains expected text
        cy.get('#edit_textbox').should('have.value', 'Hello World! @ ~');

        // * Assert channel autocomplete is not visible
        cy.get('#suggestionList').should('not.exist');

        // # In the modal click the emoji picker icon
        cy.get('#editPostEmoji').click();

        // * Assert emoji picker is visible
        cy.get('#emojiPicker').should('be.visible');

        // * Press the escape key
        cy.get('#emojiPickerSearch').wait(TIMEOUTS.HALF_SEC).type('{esc}');

        // * Assert emoji picker is not visible
        cy.get('#emojiPicker').should('not.exist');
    });

    it('MM-T102 Timestamp on edited post shows original post time', () => {
        // # Post a message
        cy.postMessage('Checking timestamp');

        cy.getLastPostId().then((postId) => {
            // # Mouseover post to display the timestamp
            cy.get(`#post_${postId}`).trigger('mouseover');

            cy.get(`#CENTER_time_${postId}`).find('time').invoke('attr', 'dateTime').then((originalTimeStamp) => {
                // # Click dot menu
                cy.clickPostDotMenu(postId);

                // # Click the edit button
                cy.get(`#edit_post_${postId}`).click();

                // # Edit the post
                cy.get('#edit_textbox').type('Some text {enter}');

                // # Mouseover the post again
                cy.get(`#post_${postId}`).trigger('mouseover');

                // * Current post timestamp should have not been changed by edition
                cy.get(`#CENTER_time_${postId}`).find('time').should('have.attr', 'dateTime').and('equal', originalTimeStamp);

                // # Open RHS by clicking the post comment icon
                cy.clickPostCommentIcon(postId);

                // * Check that the RHS is open
                cy.get('#rhsContainer').should('be.visible');

                // * Check that the RHS timeStamp equals the original post timeStamp
                cy.get(`#CENTER_time_${postId}`).find('time').invoke('attr', 'dateTime').should('equal', originalTimeStamp);
            });
        });
    });

    it('MM-T97 Open edit modal immediately after making a post', () => {
        // # Enter first message
        const firstMessage = 'Hello';
        cy.postMessage(firstMessage);

        // * Verify first message is sent and not pending
        cy.getLastPostId().then((postId) => {
            const postText = `#postMessageText_${postId}`;
            cy.get(postText).should('have.text', firstMessage);
        });

        // # Enter second message
        const secondMessage = 'World!';
        cy.postMessage(secondMessage);

        // * Verify second message is sent and not pending
        cy.getLastPostId().then((postId) => {
            const postText = `#postMessageText_${postId}`;
            cy.get(postText).should('have.text', secondMessage);

            // # Edit the last post
            cy.uiGetPostTextBox().type('{uparrow}');

            // * Edit Post Input should appear, and edit the post
            cy.get('#edit_textbox').should('be.visible');
            cy.get('#edit_textbox').should('have.text', secondMessage).type(' Another new message{enter}');
            cy.get('#edit_textbox').should('not.exist');

            // * Check the second post and verify that it contains new edited message.
            cy.get(postText).should('have.text', `${secondMessage} Another new message Edited`);
        });
    });
});
