// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @messaging

describe('Messaging', () => {
    let testTeam;
    let testChannel;
    let testUser;

    before(() => {
        cy.apiInitSetup().then(({team, channel, user}) => {
            testUser = user;
            testTeam = team;
            testChannel = channel;
            cy.apiLogin(testUser);
        });
    });

    beforeEach(() => {
        cy.visit(`/${testTeam.name}/channels/${testChannel.name}`);
    });

    it('MM-T2167 Pin a post, view pinned posts', () => {
        // # Post a message
        cy.postMessage('This is a post that is going to be pinned.');

        cy.getLastPostId().then((postId) => {
            // # On a message in center channel, click then pin the post to the channel
            cy.uiClickPostDropdownMenu(postId, 'Pin to Channel');

            // # Click pin icon next to search box
            cy.uiGetChannelPinButton().click();

            // * RHS title displays as "Pinned Posts" and "[channel name]"
            cy.get('#sidebar-right').should('be.visible').and('contain', 'Pinned Posts').and('contain', `${testChannel.display_name}`);

            // * Pinned post appear in RHS
            cy.get(`#rhsPostMessageText_${postId}`).should('exist');

            // * Message has Pinned badge in center but not in "Pinned Posts" RHS
            cy.get(`#post_${postId}`).findByText('Pinned').should('exist');
            cy.get(`#rhsPostMessageText_${postId}`).findByText('Pinned').should('not.exist');
        });
    });

    it('MM-T2168 Un-pin a post, disappears from pinned posts RHS', () => {
        // # Post a message
        cy.postMessage('This is a post that is going to be pinned then removed.');

        cy.getLastPostId().then((postId) => {
            // # On a message in center channel, click then pin the post to the channel
            cy.uiClickPostDropdownMenu(postId, 'Pin to Channel');

            // # Find the 'Pinned' span in the post pre-header to verify that the post was actually pinned
            cy.get(`#post_${postId}`).findByText('Pinned').should('exist');

            // # Click pin icon next to search box
            cy.uiGetChannelPinButton().click();

            // # View pinned posts RHS
            cy.get(`#rhsPostMessageText_${postId}`).should('exist');

            // # On a message in center channel, Click [...] > Un-pin from channel
            cy.uiClickPostDropdownMenu(postId, 'Unpin from Channel');

            // * Post disappears from RHS
            cy.get(`#rhsPostMessageText_${postId}`).should('not.exist');

            // * Pinned badge is removed from post in center
            cy.get(`#post_${postId}`).findByText('Pinned').should('not.exist');
        });
    });

    it('MM-T2169 Un-pinning a post in center also removes badge from *search results* RHS', () => {
        // # Post a message
        cy.postMessage('Hello');

        cy.getLastPostId().then((postId) => {
            // # On a message in center channel, click then pin the post to the channel
            cy.uiClickPostDropdownMenu(postId, 'Pin to Channel');

            // # Search for "Hello"
            cy.uiGetSearchBox().type('Hello').type('{enter}');

            // * Post appears in RHS search results, displays Pinned badge
            cy.get(`#searchResult_${postId}`).findByText('Pinned').should('exist');

            // # On a message in center channel, Click [...] > Un-pin from channel
            cy.uiClickPostDropdownMenu(postId, 'Unpin from Channel');

            // * Post still appears in RHS search results, but Pinned badge is removed
            cy.get(`#searchResult_${postId}`).findByText('Pinned').should('not.exist');
        });
    });

    it('MM-T2170 Un-pinning a post in *permalink* view also removes badge from saved posts RHS', () => {
        // # Post a message
        cy.postMessage('Permalink post.');

        cy.getLastPostId().then((postId) => {
            // # On a message in center channel, click then pin the post to the channel
            cy.uiClickPostDropdownMenu(postId, 'Pin to Channel');

            // # Click save icon
            cy.clickPostSaveIcon(postId);

            // # In RHS, click Jump to view permalink view
            cy.uiGetSavedPostButton().should('exist').click();
            cy.get(`#searchResult_${postId}`).should('exist');
            cy.get('a.search-item__jump').first().click();

            // * Message is displayed in center channel and highlighted (permalink view)
            cy.get(`#post_${postId}`).
                and('have.class', 'post--highlight');

            // # In permalink view, click [...] > Un-pin from channel
            cy.uiClickPostDropdownMenu(postId, 'Unpin from Channel');

            // * Pinned badge is removed in both center and RHS
            cy.get(`#post_${postId}`).findByText('Pinned').should('not.exist');
            cy.get(`#searchResult_${postId}`).findByText('Pinned').should('not.exist');
        });
    });

    it('MM-T2171 Un-pinning and pinning a post in center also removes and adds badge in *saved posts* RHS', () => {
        // # Post a message
        cy.postMessage('This is a post that is going to be pinned then removed, then pinned again.');

        cy.getLastPostId().then((postId) => {
            // # On a message in center channel, click then pin the post to the channel
            cy.uiClickPostDropdownMenu(postId, 'Pin to Channel');

            // # And also save the message
            cy.clickPostSaveIcon(postId);

            // # Open Saved posts
            cy.uiGetSavedPostButton().click();

            // * Post appears in saved posts list, and displays Pinned badge
            cy.get(`#searchResult_${postId}`).findByText('Pinned').should('exist');

            // # In center channel, click [...] > Un-pin from channel
            cy.uiClickPostDropdownMenu(postId, 'Unpin from Channel');

            // * Post still appears in saved posts list, and Pinned badge is removed in both center and RHS
            cy.get(`#post_${postId}`).findByText('Pinned').should('not.exist');
            cy.get(`#searchResult_${postId}`).findByText('Pinned').should('not.exist');

            // # In center channel, click [...] > Pin to channel
            cy.uiClickPostDropdownMenu(postId, 'Pin to Channel');

            // * Pinned badge returns on message in both center and RHS
            cy.get(`#post_${postId}`).findByText('Pinned').should('exist');
            cy.get(`#searchResult_${postId}`).findByText('Pinned').should('exist');
        });
    });

    it('MM-T2172 Non-pinned replies do not appear with parent post in pinned posts RHS', () => {
        // # Post a message
        cy.postMessage('This is a post that is going to be pinned and replied.');

        cy.getLastPostId().then((postId) => {
            // # On a message in center channel, click then pin the post to the channel
            cy.uiClickPostDropdownMenu(postId, 'Pin to Channel');

            // # Open RHS comment menu
            cy.clickPostCommentIcon(postId);

            // # Enter comment in RHS
            cy.postMessageReplyInRHS('This is a reply');

            // # Click to reply to message
            cy.getLastPostId().then((replyPostId) => {
                // # Click pin icon next to search box
                cy.uiGetChannelPinButton().click();

                // * Pinned post appear in RHS
                cy.get(`#rhsPostMessageText_${postId}`).should('exist');

                // * Reply does no appear in RHS
                cy.get(`#rhsPostMessageText_${replyPostId}`).should('not.exist');
            });
        });
    });
});
