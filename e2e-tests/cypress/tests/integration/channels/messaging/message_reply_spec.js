// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Group: @channels @messaging

import {getAdminAccount} from '../../../support/env';

describe('Message Reply', () => {
    const sysadmin = getAdminAccount();
    let newChannel;

    before(() => {
        // # Create and visit new channel
        cy.apiInitSetup({loginAfter: true}).then(({team, channel}) => {
            newChannel = channel;
            cy.visit(`/${team.name}/channels/${channel.name}`);

            // # Wait for the page to fully load before continuing
            cy.get('#sidebar-header-container').should('be.visible').and('have.text', team.display_name);
        });
    });

    it('MM-T90 Reply to older message', () => {
        // # Get yesterdays date in UTC
        const yesterdaysDate = Cypress.dayjs().subtract(1, 'days').valueOf();

        // # Post a day old message
        cy.postMessageAs({sender: sysadmin, message: 'Hello from yesterday', channelId: newChannel.id, createAt: yesterdaysDate}).
            its('id').
            should('exist').
            as('yesterdaysPost');

        // # Add two subsequent posts
        cy.postMessage('One');
        cy.postMessage('Two');

        cy.get('@yesterdaysPost').then((postId) => {
            // # Open RHS comment menu
            cy.clickPostCommentIcon(postId);

            // # Reply with the attachment
            const replyText = 'A reply to an older post with attachment';
            cy.postMessageReplyInRHS(replyText);

            // # Get the latest reply post
            cy.uiWaitUntilMessagePostedIncludes(replyText);
            cy.getLastPostId().then((replyId) => {
                // * Verify that the reply is in the channel view with matching text
                cy.get(`#post_${replyId}`).within(() => {
                    cy.findByTestId('post-link').should('be.visible').and('have.text', 'Commented on sysadmin\'s message: Hello from yesterday');
                    cy.get(`#postMessageText_${replyId}`).should('be.visible').and('have.text', 'A reply to an older post with attachment');
                });

                // * Verify that the reply is in the RHS with matching text
                cy.get(`#rhsPost_${replyId}`).within(() => {
                    cy.findByTestId('post-link').should('not.exist');
                    cy.get(`#rhsPostMessageText_${replyId}`).should('be.visible').and('have.text', 'A reply to an older post with attachment');
                });

                cy.get(`#CENTER_time_${postId}`).find('time').invoke('attr', 'dateTime').then((originalTimeStamp) => {
                    // * Verify the first post timestamp equals the RHS timestamp
                    cy.get(`#RHS_ROOT_time_${postId}`).find('time').invoke('attr', 'dateTime').should('equal', originalTimeStamp);

                    // * Verify the first post timestamp was not modified by the reply
                    cy.get(`#CENTER_time_${replyId}`).find('time').should('have.attr', 'dateTime').and('not.equal', originalTimeStamp);
                });
            });
        });

        // # Close RHS
        cy.uiCloseRHS();

        // # Verify RHS is open
        cy.get('#rhsContainer').should('not.exist');
    });
});
