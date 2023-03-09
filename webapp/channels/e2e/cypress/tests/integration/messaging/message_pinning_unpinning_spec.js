// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @messaging

const pinnedPosts = [];

/**
* Pin post by cliking on [...] then 'Pin to channel', and add the pinned post to pinnedPosts
* @param {String} postId - post ID of the post to pin
*/
function pinPost(index) {
    cy.getNthPostId(index).then((postId) => {
        cy.clickPostDotMenu(postId);
        cy.get(`#pin_post_${postId}`).click();
        pinnedPosts.push(postId);
    });
}

describe('Messaging', () => {
    before(() => {
        // # Login as test user and visit off-topic
        cy.apiInitSetup({loginAfter: true}).then(({team}) => {
            cy.visit(`/${team.name}/channels/off-topic`);
        });
    });

    it('MM-T142 Pinning or un-pinning older message does not cause it to display at bottom of channel Pinned posts display in RHS with newest at top', () => {
        // * Ensure that the channel view is loaded
        cy.uiGetPostTextBox();

        // # Post messages
        const olderPost = 7;
        for (let i = olderPost; i > 0; --i) {
            cy.postMessage(i);
        }

        // # Ensure there are a couple of pinned posts in the channel already:
        // # Pin 4th and 6th posts from latest
        pinPost(-4);
        pinPost(-6);

        // # Click on Pinned Posts channel header button
        cy.get('#channelHeaderPinButton').click();

        // * Verify the pinned posts (4 & 6) are added to the Pinned Posts list on the right hand side
        cy.get('#search-items-container').children().should('have.length', 2);

        // # Close out of the Pinned Post side bar
        cy.get('#searchResultsCloseButton').click();

        // # Get last post (7th)
        cy.getNthPostId(-olderPost).then((postId) => {
            // # Scroll into view
            cy.get(`#post_${postId}`).scrollIntoView();

            // # Click [...] > Pin to channel
            pinPost(-olderPost);

            // # Store the post message of the 20th post as pinnedPostText
            cy.get(`#postMessageText_${postId}`).invoke('text').then((pinnedPostText) => {
                // # Store the last post ID as lastPostId
                cy.getLastPostId().then((lastPostId) => {
                    // # Scroll down to the last post
                    cy.get(`#post_${lastPostId}`).scrollIntoView();

                    // * Verify that message just pinned does not display at bottom in center channel as newest in channel
                    cy.get(`#postMessageText_${lastPostId}`).should('not.contain', pinnedPostText);

                    // # Click pin icon to view pinned posts in right-hand-side
                    cy.get('#channelHeaderPinButton').click();

                    // * Verify that there are now 3 pinned messages in the right-hand-side
                    cy.get('#search-items-container').children().should('have.length', 3);

                    // * Verify sorted by newest at top: 1st post is the newest, and 3rd post is the oldest
                    cy.get('#search-items-container').children().eq(0).get(`#postMessageText_${lastPostId}`);
                    cy.get('#search-items-container').children().eq(2).get(`#postMessageText_${postId}`).and('contain', pinnedPostText);

                    // # Scroll back up to the last pinned post.
                    cy.get(`#post_${postId}`).scrollIntoView();

                    // * When un-pinned in center, post disappears from pinned posts list in right-hand-side:
                    // # Click [...] > Un-pin from channel
                    cy.clickPostDotMenu(postId);
                    cy.get(`#unpin_post_${postId}`).click();

                    // * Right-hand-side only has 2 initially pinned posts
                    cy.get('#search-items-container').children().should('have.length', 2);

                    // * Right-hand-side does not have the last pinned post.
                    cy.get('#search-items-container').children().should('not.contain', `#rhsPostMessageText_${postId}`);
                });
            });
        });
    });
});
