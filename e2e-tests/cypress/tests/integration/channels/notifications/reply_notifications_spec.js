// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @notifications

import {spyNotificationAs} from '../../../support/notification';

describe('reply-notifications', () => {
    let testTeam;
    let testChannelUrl;
    let testChannelId;
    let testChannelName;
    let receiver;
    let sender;

    before(() => {
        cy.apiCreateUser().then(({user}) => {
            sender = user;
        });

        cy.apiInitSetup().then(({team, channel, user, channelUrl}) => {
            testTeam = team;
            receiver = user;
            testChannelUrl = channelUrl;
            testChannelId = channel.id;
            testChannelName = channel.name;

            cy.apiAddUserToTeam(testTeam.id, sender.id).then(() => {
                cy.apiAddUserToChannel(testChannelId, sender.id);
            });

            // # Login as receiver
            cy.apiLogin(receiver);
        });
    });

    it('MM-T551 Do not trigger notifications on messages in reply threads unless I\'m mentioned', () => {
        cy.visit(testChannelUrl);

        // Setup notification spy
        spyNotificationAs('notifySpy', 'granted');

        // # Set users notification settings
        setReplyNotificationsSetting('#notificationCommentsNever');

        // # Post a message
        cy.postMessage('Hi there, this is a root message');

        // # Get post id of message
        cy.getLastPostId().then((postId) => {
            // # Switch to town-square so that unread notifications in test channel may be triggered
            cy.uiClickSidebarItem('town-square');

            cy.uiGetSidebarItem(testChannelName).click({force: true});

            // # Post a message in original thread as another user
            cy.postMessage('This is a reply to the root post');

            // * Verify stub was not called
            cy.get('@notifySpy').should('be.not.called');

            // * Verify unread mentions badge does not exist
            cy.uiGetSidebarItem(testChannelName).find('#unreadMentions').should('not.exist');

            // # Switch again to other channel
            cy.uiClickSidebarItem('town-square');

            // # Reply to a post as another user mentioning the receiver
            cy.postMessageAs({sender, message: `Another reply with mention @${receiver.username}`, channelId: testChannelId, rootId: postId});

            // * Verify stub was called
            cy.get('@notifySpy').should('be.called');

            // * Verify unread mentions badge exists
            cy.uiGetSidebarItem(testChannelName).find('#unreadMentions').should('be.visible');
        });
    });

    it('MM-T552 Trigger notifications on messages in threads that I start', () => {
        cy.visit(testChannelUrl);

        // Setup notification spy
        spyNotificationAs('notifySpy', 'granted');

        // # Set users notification settings
        setReplyNotificationsSetting('#notificationCommentsRoot');

        // # Post a message
        cy.postMessage('Hi there, this is another root message');

        // # Get post id of message
        cy.getLastPostId().then((postId) => {
            // # Switch to town-square so that unread notifications in test channel may be triggered
            cy.uiClickSidebarItem('town-square');

            // # Post a message in original thread as another user
            const message = 'This is a reply to the root post';
            cy.postMessageAs({sender, message, channelId: testChannelId, rootId: postId}).then(() => {
                // * Verify stub was called
                cy.get('@notifySpy').should('be.called');

                // * Verify unread mentions badge exists
                cy.uiGetSidebarItem(testChannelName).find('#unreadMentions').should('be.visible');

                // # Navigate to test channel
                cy.uiClickSidebarItem(testChannelName);

                // * Verify entire message
                cy.getLastPostId().then((msgId) => {
                    cy.get(`#postMessageText_${msgId}`).as('postMessageText');

                    // * Verify reply bar highlight
                    cy.get(`#post_${msgId}`).should('have.class', 'mention-comment');
                });
                cy.get('@postMessageText').
                    should('be.visible').
                    and('have.text', message);
            });
        });
    });

    it('MM-T553 Trigger notifications on messages in reply threads that I start or participate in - start thread', () => {
        cy.visit(testChannelUrl);

        // Setup notification spy
        spyNotificationAs('notifySpy', 'granted');

        // # Set users notification settings
        setReplyNotificationsSetting('#notificationCommentsAny');

        // # Post a message
        cy.postMessage('Hi there, this is another root message');

        // # Get post id of message
        cy.getLastPostId().then((postId) => {
            // # Switch to town-square so that unread notifications in test channel may be triggered
            cy.uiClickSidebarItem('town-square');

            // # Post a message in original thread as another user
            const message = 'This is a reply to the root post';
            cy.postMessageAs({sender, message, channelId: testChannelId, rootId: postId}).then(() => {
                // * Verify stub was called
                cy.get('@notifySpy').should('be.called');

                // * Verify unread mentions badge exists
                cy.uiGetSidebarItem(testChannelName).find('#unreadMentions').should('be.visible');

                // # Navigate to test channel
                cy.uiClickSidebarItem(testChannelName);

                // * Verify entire message
                cy.getLastPostId().then((msgId) => {
                    cy.get(`#postMessageText_${msgId}`).as('postMessageText');

                    // * Verify reply bar highlight
                    cy.get(`#post_${msgId}`).should('have.class', 'mention-comment');
                });
                cy.get('@postMessageText').
                    should('be.visible').
                    and('have.text', message);
            });
        });
    });

    it('MM-T554 Trigger notifications on messages in reply threads that I start or participate in - participate in', () => {
        cy.visit(testChannelUrl);

        // Setup notification spy
        spyNotificationAs('notifySpy', 'granted');

        // # Set users notification settings
        setReplyNotificationsSetting('#notificationCommentsAny');

        // # Make a root post as some other user
        const rootPostMessage = 'a root message by some other user';
        cy.postMessageAs({sender, message: rootPostMessage, channelId: testChannelId}).then((post) => {
            const rootPostId = post.id;
            const rootPostMessageId = `#rhsPostMessageText_${rootPostId}`;

            // # Click comment icon to open RHS
            cy.clickPostCommentIcon(rootPostId);

            // * Check that the RHS is open
            cy.get('#rhsContainer').should('be.visible');

            // * Verify that the original message is in the RHS
            cy.get('#rhsContainer').find(rootPostMessageId).should('have.text', `${rootPostMessage}`);

            // # Post a reply as receiver, i.e. participate in the thread
            cy.postMessageReplyInRHS('this is a reply from the receiver');

            // # Wait till receiver's post is visible
            cy.getLastPostId().then(() => {
                // # Switch to town-square so that unread notifications in test channel may be triggered
                cy.uiClickSidebarItem('town-square');

                // # Post a message in thread as another user
                const message = 'This is a reply by sender';
                cy.postMessageAs({sender, message, channelId: testChannelId, rootId: rootPostId}).then(() => {
                    // * Verify stub was called
                    cy.get('@notifySpy').should('be.called');

                    // * Verify unread mentions badge exists
                    cy.uiGetSidebarItem(testChannelName).find('#unreadMentions').should('be.visible');

                    // # Navigate to test channel
                    cy.uiClickSidebarItem(testChannelName);

                    cy.getLastPostId().then((msgId) => {
                        // * Verify entire message
                        cy.get(`#postMessageText_${msgId}`).
                            should('be.visible').
                            and('have.text', message);

                        // * Verify reply bar highlight
                        cy.get(`#rhsPost_${msgId}`).should('have.class', 'mention-comment');
                    });
                });
            });
        });
    });
});

function setReplyNotificationsSetting(idToToggle) {
    // Navigate to settings modal
    cy.uiOpenSettingsModal();

    // Notifications header should be visible
    cy.get('#notificationSettingsTitle').
        scrollIntoView().
        should('be.visible').
        and('contain', 'Notifications');

    // Open up 'Reply Notifications' sub-section
    cy.get('#commentsTitle').
        scrollIntoView().
        click();

    cy.get(idToToggle).check().should('be.checked');

    // Click “Save” and close modal
    cy.uiSaveAndClose();
}
