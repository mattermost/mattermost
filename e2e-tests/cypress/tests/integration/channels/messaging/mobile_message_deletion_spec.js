// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @messaging

describe('Delete Parent Message', () => {
    before(() => {
        // # Set view port to mobile
        cy.viewport('iphone-6');

        // # Login as test user and visit town-square channel
        cy.apiInitSetup({loginAfter: true}).then(({team}) => {
            cy.visit(`/${team.name}/channels/off-topic`);
        });
    });

    it('MM-T110 Delete a parent message that has a reply: Reply RHS', () => {
        // # Close Hamburger menu, post a message, and add replies
        cy.uiGetPostTextBox().click({force: true});
        cy.postMessage('Parent Message');

        cy.getLastPostId().then((postId) => {
            cy.clickPostCommentIcon(postId);

            // * Check that the RHS is open
            cy.get('#rhsContainer').should('be.visible');

            // * Add 2 replies
            const replyCount = 2;
            for (var i = 0; i < replyCount; i++) {
                cy.postMessageReplyInRHS('Reply');
            }

            cy.getLastPostId().then((replyPostId) => {
                // * No delete modal should be visible yet
                cy.get('#deletePostModal').should('not.exist');

                // #Close RHS view, open delete confirmation modal for the parent message from the center screen
                cy.get('#sbrSidebarCollapse').click();
                cy.clickPostDotMenu(postId);
                cy.get(`#delete_post_${postId}`).click();

                // * Modal should now be visible and warning message should match the number of replies
                cy.get('#deletePostModal').should('be.visible');
                cy.get('#deletePostModal').contains(replyCount).should('be.visible');

                // # Delete the parent message
                cy.get('#deletePostModalButton').click({force: true});

                // * Post is deleted from both center and RHS is not visible to the user who deleted it
                cy.get('#rhsContainer').should('not.exist');
                cy.get(`#post_${postId}`).should('not.exist');
                cy.get(`#post_${replyPostId}`).should('not.exist');
            });
        });
    });
});
