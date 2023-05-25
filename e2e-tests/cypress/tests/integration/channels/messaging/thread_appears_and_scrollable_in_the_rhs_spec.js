// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @messaging

import * as TIMEOUTS from '../../../fixtures/timeouts';

describe('Thread Scrolling Inside RHS ', () => {
    beforeEach(function() {
        cy.
            apiCreateUser().its('user').as('otherUser').
            apiInitSetup().
            then(({user, team, channel, channelUrl}) => cy.
                apiAddUserToTeam(team.id, this.otherUser.id).
                apiAddUserToChannel(channel.id, this.otherUser.id).
                wrap(user).as('mainUser').
                wrap(channel).as('channel').
                wrap(channelUrl).as('channelUrl'),
            );
    });

    it('MM-T3293 The entire thread appears in the RHS (scrollable)', function() {
        const NUMBER_OF_REPLIES = 100;
        const NUMBER_OF_MAIN_THREAD_MESSAGES = 40;

        cy.

            // # Create a thread with several replies to make it scrollable in RHS
            postMessageAs({sender: this.mainUser, message: 'First message', channelId: this.channel.id}).
            as('firstPost').

            then((firstPost) => cy.postListOfMessages({
                numberOfMessages: NUMBER_OF_REPLIES,
                sender: this.mainUser,
                channelId: this.channel.id,
                rootId: firstPost.id,
            })).
            then((messages) => messages.map((m) => m.data.message)).
            as('replies').

            // # Create enough posts from another user (not related to the thread on the same channel) to not load on a first load
            then(() => cy.postListOfMessages({
                numberOfMessages: NUMBER_OF_MAIN_THREAD_MESSAGES,
                sender: this.otherUser,
                channelId: this.channel.id,
            })).

            // # Reply on original thread
            then(() => cy.postMessageAs({
                sender: this.mainUser,
                message: 'Last Reply',
                channelId: this.channel.id,
                rootId: this.firstPost.id,
            })).
            then((lastReply) => {
            // # Load the channel
                cy.visit(this.channelUrl);

                // # Hit on reply to open thread on RHS
                cy.clickPostCommentIcon(lastReply.id);

                // * Verify that entire thread appears in the RHS (scrollable)
                cy.uiGetRHS().within(() => {
                    cy.findByText(lastReply.data.message).should('exist');

                    // We iterate the message list from the end
                    // checking messages one by one
                    // and scrolling up on every step to load more previous messages
                    this.replies.reduceRight(
                        (chain, reply) => chain.then(() => cy.findByText(reply).scrollIntoView().wait(TIMEOUTS.ONE_HUNDRED_MILLIS)),
                        cy,
                    );

                    cy.findByText(this.firstPost.data.message).should('exist');
                });
            });
    });
});
