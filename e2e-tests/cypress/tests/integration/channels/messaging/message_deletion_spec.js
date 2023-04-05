// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @messaging

describe('Message deletion', () => {
    before(() => {
        // # Login as test user and visit off-topic
        cy.apiInitSetup({loginAfter: true}).then(({offTopicUrl}) => {
            cy.visit(offTopicUrl);
        });
    });

    it('MM-T112 Delete a parent message that has a reply - reply thread', () => {
        // # Post message in center.
        cy.postMessage('test message deletion');

        cy.getLastPostId().then((parentMessageId) => {
            // # Mouseover the post and click post comment icon.
            cy.clickPostCommentIcon();

            // * Check that the RHS is open
            cy.uiGetRHS();

            // # Post a reply in RHS.
            cy.postMessageReplyInRHS('test message reply in RHS');

            cy.getLastPostId().then((replyMessageId) => {
                // # Click post dot menu in center.
                cy.clickPostDotMenu(parentMessageId);

                // # Click delete button.
                cy.get(`#delete_post_${parentMessageId}`).click();

                // * Check that confirmation dialog is open.
                cy.get('#deletePostModal').should('be.visible');

                // * Check that confirmation dialog contains correct text
                cy.get('#deletePostModal').should('contain', 'Are you sure you want to delete this Post?');

                // * Check that confirmation dialog shows that the post has one comment on it
                cy.get('#deletePostModal').should('contain', 'This post has 1 comment on it.');

                // # Confirm deletion.
                cy.get('#deletePostModalButton').click();

                // * Check that the modal is closed
                cy.get('#deletePostModal').should('not.exist');

                // * Check that the RHS is closed.
                cy.uiGetRHS({exist: false});

                // * Check that parent message is no longer visible.
                cy.get(`#post_${parentMessageId}`).should('not.exist');

                // * Check that reply message is no longer visible.
                cy.get(`#post_${replyMessageId}`).should('not.exist');
            });

            cy.getLastPostId().then((replyMessageId) => {
                // * Check that last message do not contain (message deleted)
                cy.get(`#post_${replyMessageId}`).should('not.contain', '(message deleted)');
            });
        });
    });
});
