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

    it('MM-T562 New message bar - Message posted while scrolled up in same channel', () => {
        // # Post 30 random messages from the 'otherUser' account in off-topic
        Cypress._.times(numberOfPosts, (num) => {
            cy.postMessageAs({sender: otherUser, message: `${num} ${getRandomId()}`, channelId: offTopicChannelId});
        });

        // # Scroll to the top of the channel so that the 'Jump to New Messages' button would be visible
        cy.get('.post-list__dynamic').scrollTo('top');

        // # Post two new messages as 'otherUser'
        cy.postMessageAs({sender: otherUser, message: 'Random Message', channelId: offTopicChannelId});
        cy.postMessageAs({sender: otherUser, message: 'Last Message', channelId: offTopicChannelId});

        // * Verify that the last message is currently not visible
        cy.findByText('Last Message').should('not.be.visible');

        // # Click on the 'Jump to New Messages' button
        cy.get('.toast__visible').should('be.visible').click();

        // * Verify that the last message is now visible
        cy.findByText('Last Message').should('be.visible');

        // * Verify that 'Jump to New Messages' is not visible
        cy.get('.toast__visible').should('not.exist');
    });
});
