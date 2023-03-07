// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @mark_as_unread

import {beUnread} from '../../support/assertions';

import {verifyPostNextToNewMessageSeparator, switchToChannel} from './helpers';

describe('Mark post with mentions as unread', () => {
    let userA;
    let userB;

    let channelA;
    let channelB;

    let testTeam;

    before(() => {
        cy.apiInitSetup().then(({team, user, channel}) => {
            userA = user;
            channelA = channel;
            testTeam = team;

            // # Create second channel and add userA
            cy.apiCreateChannel(team.id, 'channel-b', 'Channel B').then((out) => {
                channelB = out.channel;
                cy.apiAddUserToChannel(channelB.id, userA.id);
            });

            // # Create a second user
            cy.apiCreateUser().then(({user: user2}) => {
                userB = user2;

                // # Add userB to channel team and channels
                cy.apiAddUserToTeam(testTeam.id, userB.id).then(() => {
                    cy.apiAddUserToChannel(channelA.id, userB.id);
                    cy.apiAddUserToChannel(channelB.id, userB.id);
                });

                cy.visit(`/${testTeam.name}/channels/town-square`);
            });
        });
    });

    it('MM-T247 Marks posts with mentions as unread', () => {
        // # Login as userB
        cy.apiLogin(userB);
        cy.visit(`/${testTeam.name}/channels/town-square`);

        // # Navigate to both channels, so the new messages line appears above posts
        switchToChannel(channelA);
        switchToChannel(channelB);

        // # Mention userB in channel A as userA
        cy.postMessageAs({
            sender: userA,
            message: `@${userB.username} : hello1`,
            channelId: channelA.id,
        });

        // * Verify that channelA has unread in LHS
        cy.get(`#sidebarItem_${channelA.name}`).should(beUnread);

        // * Verify that ChannelA has unread mention in LHS
        cy.get(`#sidebarItem_${channelA.name}`).children('#unreadMentions').should('have.text', '1');

        // # Navigate to channel A
        switchToChannel(channelA);

        // * Verify that ChannelA no longer has unread mention in LHS
        cy.get(`#sidebarItem_${channelA.name}`).children('#unreadMentions').should('not.exist');

        // * Verify that new message separator exists above the unread message
        verifyPostNextToNewMessageSeparator(`@${userB.username} : hello1`);

        // # Navigate to channel B
        switchToChannel(channelB);

        // # Navigate back to channel A
        switchToChannel(channelA);

        // * Verify that new message separator is gone
        cy.get('.NotificationSeparator').should('not.exist');

        // # Mention userB in channel B as userA
        cy.postMessageAs({
            sender: userA,
            message: `@${userB.username} : hello2`,
            channelId: channelB.id,
        });

        // # Navigate to channel B
        switchToChannel(channelB);

        // * Verify that new message separator exists above the unread message
        verifyPostNextToNewMessageSeparator(`@${userB.username} : hello2`);

        // # Refresh the page
        cy.reload();

        // * Verify the new message separator is gone
        cy.get('.NotificationSeparator').should('not.exist');

        // # Mention userB in channelA as userA
        cy.postMessageAs({
            sender: userA,
            message: `@${userB.username} : hello3`,
            channelId: channelA.id,
        });

        // # Navigate back to channel A
        switchToChannel(channelA);

        // * Verify the new message separator exists above the unread message
        verifyPostNextToNewMessageSeparator(`@${userB.username} : hello3`);

        // # Get the ID of the last post
        cy.getLastPostId().then((postId) => {
            // # Mark last post as unread from menu
            cy.uiClickPostDropdownMenu(postId, 'Mark as Unread');
        });

        // * Verify the new message separator still exists above the unread message
        verifyPostNextToNewMessageSeparator(`@${userB.username} : hello3`);

        // * Verify that channelA has unread in LHS
        cy.get(`#sidebarItem_${channelA.name}`).should(beUnread);

        // * Verify that ChannelA has unread mention in LHS
        cy.get(`#sidebarItem_${channelA.name}`).children('#unreadMentions').should('have.text', '1');

        // # Navigate to channel B
        switchToChannel(channelB);

        // # Navigate back to channel A
        switchToChannel(channelA);

        // * Verify the new message separator still exists above the unread message
        verifyPostNextToNewMessageSeparator(`@${userB.username} : hello3`);

        // * Verify that ChannelA no longer has unread mention in LHS
        cy.get(`#sidebarItem_${channelA.name}`).children('#unreadMentions').should('not.exist');

        // # Mention userB in channelB as userA
        cy.postMessageAs({
            sender: userA,
            message: `@${userB.username} : hello4`,
            channelId: channelB.id,
        });

        // # Navigate to channel B
        switchToChannel(channelB);

        // # Get the ID of the last post
        cy.getLastPostId().then((postId) => {
            // # Mark last post as unread from menu
            cy.uiClickPostDropdownMenu(postId, 'Mark as Unread');
        });

        // * Verify the new message separator exists above the unread message
        verifyPostNextToNewMessageSeparator(`@${userB.username} : hello4`);

        // * Verify that ChannelB has unread mention in LHS
        cy.get(`#sidebarItem_${channelB.name}`).children('#unreadMentions').should('have.text', '1');

        // # Refresh the page
        cy.reload();

        // * Verify the new message separator still exists above the unread message
        verifyPostNextToNewMessageSeparator(`@${userB.username} : hello4`);

        // # Navigate to channel A
        switchToChannel(channelA);

        // * Verify that ChannelB no longer has unread mention in LHS
        cy.get(`#sidebarItem_${channelB.name}`).children('#unreadMentions').should('not.exist');
    });
});
