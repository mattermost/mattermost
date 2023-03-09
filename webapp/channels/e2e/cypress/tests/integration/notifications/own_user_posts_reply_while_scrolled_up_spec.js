// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @notifications

import {getRandomId} from '../../utils';

describe('Notifications', () => {
    let otherUser;
    let offTopicChannelId;
    const numberOfPosts = 30;

    before(() => {
        cy.apiInitSetup().then(({team, user, offTopicUrl}) => {
            otherUser = user;

            cy.apiGetChannelByName(team.name, 'off-topic').then(({channel}) => {
                offTopicChannelId = channel.id;
            });

            cy.visit(offTopicUrl);
        });
    });

    it('MM-T564 New message bar - Own user posts a reply while scrolled up in a channel', () => {
        // # Post 30 random messages from the 'otherUser' account in off-topic
        Cypress._.times(numberOfPosts, (num) => {
            cy.postMessageAs({sender: otherUser, message: `${num} ${getRandomId()}`, channelId: offTopicChannelId});
        });

        // # Click on the post comment icon of the last message
        cy.clickPostCommentIcon();

        // # Scroll to the top of the channel so that the 'Jump to New Messages' button would be visible (if it existed)
        cy.get('.post-list__dynamic').scrollTo('top');

        // # Post a reply in RHS
        const message = 'This is a test message';
        cy.postMessageReplyInRHS(message);

        // * 'Jump to New Messages' is not visible
        cy.get('.toast__visible').should('not.exist');

        // * Message gets posted in off-topic
        cy.uiWaitUntilMessagePostedIncludes(message);
    });
});
