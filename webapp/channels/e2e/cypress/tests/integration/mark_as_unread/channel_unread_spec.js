// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Group: @channel

import {beRead, beUnread} from '../../support/assertions';

import {verifyPostNextToNewMessageSeparator, switchToChannel} from './helpers';

describe('channel unread posts', () => {
    let testUser;
    let otherUser;

    let channelA;
    let channelB;

    beforeEach(() => {
        cy.apiAdminLogin();

        // # Create testUser added to channel
        cy.apiInitSetup().then(({team, channel, user}) => {
            testUser = user;
            channelA = channel;

            // # Create second channel and add testUser
            cy.apiCreateChannel(team.id, 'channel-b', 'Channel B').then((out) => {
                channelB = out.channel;
                cy.apiAddUserToChannel(channelB.id, testUser.id);
            });

            // # Create otherUser, add to team, and add to both channelA and channelB
            cy.apiCreateUser().then(({user: user2}) => {
                otherUser = user2;

                cy.apiAddUserToTeam(team.id, otherUser.id).then(() => {
                    cy.apiAddUserToChannel(channelA.id, otherUser.id);
                    cy.apiAddUserToChannel(channelB.id, otherUser.id);
                });

                for (let index = 0; index < 5; index++) {
                    // # Post Message as Current user
                    const message = `hello from current user: ${index}`;

                    cy.postMessageAs({sender: testUser, message, channelId: channelA.id});
                }
            });

            cy.apiLogin(testUser);
            cy.visit(`/${team.name}/channels/town-square`);
        });
    });

    it('MM-T246 Mark Post as Unread', () => {
        // # Login as other user
        cy.apiLogin(otherUser);

        // # Switch to channelA
        switchToChannel(channelA);

        // # Mark the last post as unread
        cy.getLastPostId().then((postId) => {
            cy.uiClickPostDropdownMenu(postId, 'Mark as Unread');
        });

        // * Verify the notification separator line exists and present before the unread message
        verifyPostNextToNewMessageSeparator('hello from current user: 4');

        // # Switch to channelB
        switchToChannel(channelB);

        // * Verify the channelA has unread in LHS
        cy.get(`#sidebarItem_${channelA.name}`).should(beUnread);

        // # Switch to channelA
        switchToChannel(channelA);

        // * Verify the channelA has does not have unread in LHS
        cy.get(`#sidebarItem_${channelA.name}`).should(beRead);

        // * Verify the notification separator line exists and present before the unread message
        verifyPostNextToNewMessageSeparator('hello from current user: 4');

        // # Switch to channelB
        switchToChannel(channelB);

        // * Verify the channelA has does not have unread in LHS
        cy.get(`#sidebarItem_${channelA.name}`).should(beRead);
    });

    it('MM-T256 Mark unread before a page of message in Channel', () => {
        // # Login as other user
        cy.apiLogin(otherUser);

        // # Switch to channelA
        switchToChannel(channelA);

        for (let index = 5; index < 40; index++) {
            // # Post Message as Current user
            const message = `hello from current user: ${index}`;

            cy.postMessageAs({sender: testUser, message, channelId: channelA.id});
        }

        // # Mark the post which is one page above from bottom as unread
        cy.getNthPostId(6).then((postId) => {
            cy.get(`#post_${postId}`).scrollIntoView().should('be.visible');
            cy.uiClickPostDropdownMenu(postId, 'Mark as Unread');
        });

        // * Verify the notification separator line exists and present before the unread message
        verifyPostNextToNewMessageSeparator('hello from current user: 5');

        // # Switch to channelB
        switchToChannel(channelB);

        // # Switch to channelA
        switchToChannel(channelA);

        // * Verify the notification separator line exists and present before the unread message
        verifyPostNextToNewMessageSeparator('hello from current user: 5');
    });

    it('MM-T259 Mark as Unread channel remains unread when receiving new message', () => {
        // # Login as other user
        cy.apiLogin(otherUser);

        // # Switch to channelA
        switchToChannel(channelA);

        // # Mark the last post as unread
        cy.getLastPostId().then((postId) => {
            cy.uiClickPostDropdownMenu(postId, 'Mark as Unread');
        });

        // * Verify the notification separator line exists and present before the unread message
        verifyPostNextToNewMessageSeparator('hello from current user: 4');

        // * Verify the channelA has unread in LHS
        cy.get(`#sidebarItem_${channelA.name}`).should(beUnread);

        for (let index = 5; index < 10; index++) {
            // # Post Message as Current user
            const message = `hello from current user: ${index}`;

            cy.postMessageAs({sender: testUser, message, channelId: channelA.id});

            // * Verify the channelA has unread in LHS even when the messages are coming through
            cy.get(`#sidebarItem_${channelA.name}`).should(beUnread);
        }

        // # Switch to channelB
        switchToChannel(channelB);

        // * Verify the channelA has unread in LHS
        cy.get(`#sidebarItem_${channelA.name}`).should(beUnread);

        // # Switch to channelA
        switchToChannel(channelA);

        // * Verify the channelA has does not have unread in LHS
        cy.get(`#sidebarItem_${channelA.name}`).should(beRead);
    });
});
