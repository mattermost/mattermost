// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @notifications

import * as MESSAGES from '../../../fixtures/messages';
import * as TIMEOUTS from '../../../fixtures/timeouts';

describe('Notifications', () => {
    let testTeam;
    let testChannel;
    let otherUser;

    beforeEach(() => {
        cy.apiInitSetup().then(({team, channel, user}) => {
            testTeam = team;
            testChannel = channel;
            otherUser = user;

            cy.visit(`/${testTeam.name}/channels/${channel.name}`);
        });
    });

    it('MM-T565 New message bar - Doesnt display for emoji reaction', () => {
        // # Make a starting post from the user 1
        cy.postMessage(MESSAGES.SMALL);

        // # Make a few posts from user 2 so that center can be scrolled
        Cypress._.times(30, (postNumber) => {
            cy.postMessageAs({sender: otherUser, message: `P${postNumber}`, channelId: testChannel.id});
        });

        // # Make a final post from the user 1 where reaction will be added
        cy.postMessage('This post will have a reaction');

        // # Scroll to top of the channel to first post
        cy.getNthPostId(1).then((firstPostId) => {
            cy.get(`#post_${firstPostId}`).should('exist').scrollIntoView();
        });

        // # Get the last posted message
        cy.getLastPostId().then((lastPostID) => {
            // # Add a reaction to the last post with another user
            cy.reactToMessageAs({sender: otherUser, postId: lastPostID, reaction: 'smile'});
        });

        // * Verify that new message bar is not visible even after a new reaction
        // was added to the message in the bottom
        cy.get('.toast.toast__visible').should('not.exist');
    });

    it('MM-T566 New message bar - Displays in permalink view', () => {
        cy.makeClient().then(async (client) => {
            const townChannel = await client.getChannelByName(testTeam.id, 'town-square');
            const townChannelId = townChannel.id;

            // # Post messages in town-square channel
            Cypress._.times(15, (postNumber) => {
                cy.postMessageAs({sender: otherUser, message: `P${postNumber}`, channelId: townChannelId});
            });

            // # Enter "in:town-square" in the search bar and hit ENTER
            cy.uiGetSearchContainer().click();
            cy.uiGetSearchBox().
                typeWithForce('in:town-square').
                wait(TIMEOUTS.HALF_SEC).
                typeWithForce('{enter}').
                typeWithForce('{enter}');

            // # Click "Jump" to one of the search results
            cy.get('a.search-item__jump').last().click();

            // * Verify permalink in main channel view (post highlighted, fades in 6sec.)
            cy.getNthPostId(1).then((postIdTest) => {
                cy.get(`#post_${postIdTest}`, {timeout: TIMEOUTS.HALF_MIN}).should('have.class', 'post--highlight');
                cy.clock();
                cy.tick(6000);
                cy.get(`#post_${postIdTest}`).should('not.have.class', 'post--highlight');
            });

            // # Other user post a message in town-square channel
            cy.postMessageAs({
                sender: otherUser,
                message: 'message from user B',
                channelId: townChannelId,
            });

            // * Verify New message bar appears
            cy.get('.NotificationSeparator').should('exist');
        });
    });
});
