// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @messaging

import {getAdminAccount} from '../../support/env';

describe('Messaging', () => {
    const sysadmin = getAdminAccount();
    let newChannel;

    before(() => {
        // # Create and visit new channel
        cy.apiInitSetup().then(({team, channel}) => {
            newChannel = channel;
            cy.visit(`/${team.name}/channels/${channel.name}`);
        });
    });

    it('MM-T93 Replying to an older bot post that has no post content and no attachment pretext', () => {
        // # Get yesterdays date in UTC
        const yesterdaysDate = Cypress.dayjs().subtract(1, 'days').valueOf();

        // # Create a bot and get userID
        cy.apiCreateBot().then(({bot}) => {
            const botUserId = bot.user_id;
            cy.externalRequest({user: sysadmin, method: 'put', path: `users/${botUserId}/roles`, data: {roles: 'system_user system_post_all system_admin'}});

            // # Get token from bots id
            cy.apiAccessToken(botUserId, 'Create token').then(({token}) => {
                //# Add bot to team
                cy.apiAddUserToTeam(newChannel.team_id, botUserId);

                // # Post message with auth token
                const props = {attachments: [{text: 'Some Text posted by bot that has no content and no attachment pretext'}]};
                cy.postBotMessage({token, props, channelId: newChannel.id, createAt: yesterdaysDate}).
                    its('id').
                    should('exist').
                    as('yesterdaysBotPost');
            });

            // # Add two subsequent posts
            cy.postMessage('First posting');
            cy.postMessage('Another one Posted');

            const replyMessage = 'A reply to an older post bot post';

            cy.get('@yesterdaysBotPost').then((postId) => {
                // # Open RHS comment menu
                cy.clickPostCommentIcon(postId);

                // # Reply to message
                cy.postMessageReplyInRHS(replyMessage);

                // # Get the latest reply post
                cy.getLastPostId().then((replyId) => {
                    // * Verify that the reply is in the RHS with matching text
                    cy.get(`#rhsPost_${replyId}`).within(() => {
                        cy.findByTestId('post-link').should('not.exist');
                        cy.get(`#rhsPostMessageText_${replyId}`).should('be.visible').and('have.text', replyMessage);
                    });

                    cy.get(`#CENTER_time_${postId}`).find('time').invoke('attr', 'dateTime').then((originalTimeStamp) => {
                        // * Verify the first post timestamp equals the RHS timestamp
                        cy.get(`#RHS_ROOT_time_${postId}`).find('time').invoke('attr', 'dateTime').should('equal', originalTimeStamp);

                        // * Verify the first post timestamp was not modified by the reply
                        cy.get(`#CENTER_time_${replyId}`).find('time').should('have.attr', 'dateTime').and('not.equal', originalTimeStamp);
                    });

                    //# Close RHS
                    cy.uiCloseRHS();

                    // * Verify that the reply is in the channel view with matching text
                    cy.get(`#post_${replyId}`).within(() => {
                        cy.findByTestId('post-link').should('be.visible').and('have.text', 'Commented on ' + bot.username + 'BOT\'s message: Some Text posted by bot that has no content and no attachment pretext');
                        cy.get(`#postMessageText_${replyId}`).should('be.visible').and('have.text', replyMessage);
                    });
                });
            });

            // # Verify RHS is closed
            cy.get('#rhsContainer').should('not.exist');
        });
    });

    it('MM-T91 Replying to an older post by a user that has no content (only file attachments)', () => {
        // # Get yesterdays date in UTC
        const yesterdaysDate = Cypress.dayjs().subtract(1, 'days').valueOf();

        // # Create a bot and get userID
        cy.apiCreateBot().then(({bot}) => {
            const botUserId = bot.user_id;
            cy.externalRequest({user: sysadmin, method: 'put', path: `users/${botUserId}/roles`, data: {roles: 'system_user system_post_all system_admin'}});

            // # Get token from bots id
            cy.apiAccessToken(botUserId, 'Create token').then(({token}) => {
                //# Add bot to team
                cy.apiAddUserToTeam(newChannel.team_id, botUserId);

                // # Post message with auth token
                const message = 'Hello message from ' + bot.username;
                const props = {attachments: [{pretext: 'Some Pretext', text: 'Some Text'}]};
                cy.postBotMessage({token, message, props, channelId: newChannel.id, createAt: yesterdaysDate}).
                    its('id').
                    should('exist').
                    as('yesterdaysPost');
            });

            // # Add two subsequent posts
            cy.postMessage('First post');
            cy.postMessage('Another Post');

            const replyMessage = 'A reply to an older post with message attachment';

            cy.get('@yesterdaysPost').then((postId) => {
                // # Open RHS comment menu
                cy.clickPostCommentIcon(postId);

                // # Reply to message
                cy.postMessageReplyInRHS(replyMessage);

                // # Get the latest reply post
                cy.getLastPostId().then((replyId) => {
                    // * Verify that the reply is in the RHS with matching text
                    cy.get(`#rhsPost_${replyId}`).within(() => {
                        cy.findByTestId('post-link').should('not.exist');
                        cy.get(`#rhsPostMessageText_${replyId}`).should('be.visible').and('have.text', replyMessage);
                    });

                    cy.get(`#CENTER_time_${postId}`).find('time').invoke('attr', 'dateTime').then((originalTimeStamp) => {
                        // * Verify the first post timestamp equals the RHS timestamp
                        cy.get(`#RHS_ROOT_time_${postId}`).find('time').invoke('attr', 'dateTime').should('equal', originalTimeStamp);

                        // * Verify the first post timestamp was not modified by the reply
                        cy.get(`#CENTER_time_${replyId}`).find('time').should('have.attr', 'dateTime').and('not.equal', originalTimeStamp);
                    });

                    //# Close RHS
                    cy.uiCloseRHS();

                    // * Verify that the reply is in the channel view with matching text
                    cy.get(`#post_${replyId}`).within(() => {
                        cy.findByTestId('post-link').should('be.visible').and('have.text', 'Commented on ' + bot.username + 'BOT\'s message: Hello message from ' + bot.username);
                        cy.get(`#postMessageText_${replyId}`).should('be.visible').and('have.text', replyMessage);
                    });
                });
            });

            // # Verify RHS is closed
            cy.get('#rhsContainer').should('not.exist');
        });
    });
});
