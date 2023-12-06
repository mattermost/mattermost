// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @mark_as_unread

describe('Verify unread toast appears after repeated manual marking post as unread', () => {
    let currentChannel;

    before(() => {
        cy.apiInitSetup().then(({team, channel, user}) => {
            currentChannel = channel;
            cy.apiCreateUser().then(({user: user2}) => {
                cy.apiAddUserToTeam(team.id, user2.id).then(() => {
                    cy.apiAddUserToChannel(channel.id, user2.id);

                    // # Create a page full of messages
                    Cypress._.times(30, (i) => {
                        cy.postMessageAs({
                            sender: user2,
                            message: `post${i}`,
                            channelId: channel.id,
                        });
                    });

                    // # Make a mentioned message
                    cy.postMessageAs({
                        sender: user2,
                        message: `hi @${user.username}`,
                        channelId: channel.id,
                    });

                    // # Login as user
                    cy.apiLogin(user);

                    // # Visit the channel
                    cy.visit(`/${team.name}/channels/${channel.name}`);

                    // # Post a reply on RHS
                    cy.getLastPostId().then((postId) => {
                        cy.clickPostCommentIcon(postId);
                        cy.get('#rhsContainer').should('be.visible');
                        const replyMessage = 'A reply to an older post';
                        cy.postMessageReplyInRHS(replyMessage);
                    });
                });
            });
        });
    });

    it('MM-T254 Rehydrate mention badge after post is marked as Unread', () => {
        // # Mark the first post as unread
        cy.getNthPostId(1).then((postId) => {
            cy.get(`#post_${postId}`).scrollIntoView().should('be.visible');
            cy.uiClickPostDropdownMenu(postId, 'Mark as Unread');
        });

        // * Check that the toast is visible
        cy.get('div.toast').should('be.visible').then(() => {
            // * Check that the message is correct and all the mentions and replies are counted in toast
            cy.get('div.toast__message>span').should('be.visible').contains('30 new messages');

            cy.get(`#sidebarItem_${currentChannel.name}`).
                scrollIntoView().
                find('#unreadMentions').
                should('be.visible').
                and('have.text', '1');
        });
    });
});
