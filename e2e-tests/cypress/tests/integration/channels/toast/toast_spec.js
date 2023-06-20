// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// # Indicates a test step (e.g. # Go to a page)
// [*] indicates an assertion (e.g. * Check the title)
// Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Group: @channels @toast

import * as TIMEOUTS from '../../../fixtures/timeouts';

import {
    scrollDown,
    scrollUp,
    scrollUpAndPostAMessage,
} from './helpers';

describe('toasts', () => {
    let otherUser;
    let testTeam;
    let testChannelId;
    let testChannelName;
    let otherChannel;

    before(() => {
        // # Create other user
        cy.apiCreateUser().then(({user}) => {
            otherUser = user;
        });

        // # Build data to test and login as testUser
        cy.apiInitSetup().then(({team, channel, user, channelUrl}) => {
            testTeam = team;
            otherChannel = channel;
            testChannelName = channel.name;
            testChannelId = channel.id;

            cy.apiAddUserToTeam(testTeam.id, otherUser.id).then(() => {
                cy.apiAddUserToChannel(testChannelId, otherUser.id).then(() => {
                    cy.apiLogin(user);
                    cy.visit(channelUrl);
                });
            });
        });
    });

    beforeEach(() => {
        // # Click on test channel then off-topic channel in LHS
        cy.uiClickSidebarItem(testChannelName);
        cy.uiClickSidebarItem('off-topic');
    });

    it('Unread messages toast is shown when visiting a channel with unreads and should disappear if scrolled to bottom', () => {
        // # Add enough messages
        for (let index = 0; index < 30; index++) {
            cy.postMessageAs({sender: otherUser, message: `This is an old message [${index}]`, channelId: testChannelId});
        }

        cy.uiClickSidebarItem(testChannelName);

        // * Verify the toast is visible with correct message
        cy.get('div.toast').should('be.visible').contains('30 new messages');

        // # Scroll to the bottom
        scrollDown();

        // * Verify toast jump is not visible
        cy.get('div.toast__jump').should('not.exist');

        // * Verify toast is not visible
        cy.get('div.toast').should('not.exist');
    });

    it('Should show new message indicator when posts arrive and user is not at bottom', () => {
        cy.uiClickSidebarItem(testChannelName);
        scrollUpAndPostAMessage(otherUser, testChannelId);

        // * Verify the toast is visible with correct message
        cy.get('div.toast').should('be.visible').contains('1 new message');
    });

    it('New message toast should not have action button when at bottom and hide toast in a sec', () => {
        cy.uiClickSidebarItem(testChannelName);
        scrollUpAndPostAMessage(otherUser, testChannelId);

        // * Verify the toast is visible
        cy.get('div.toast').should('be.visible');

        // # Scroll to the bottom
        scrollDown();

        // * Verify toast jump is not visible
        cy.get('div.toast__jump').should('not.exist');

        // * Verify toast is not visible
        cy.get('div.toast').should('not.exist');
    });

    it('New message toast should take to new messages line when clicked', () => {
        cy.uiClickSidebarItem(testChannelName);

        // # Scroll up so bottom is not visible
        scrollUp();

        // # Post few new message
        for (let index = 0; index < 4; index++) {
            cy.postMessageAs({sender: otherUser, message: `This is a new message [${index}]`, channelId: testChannelId});
        }

        // * Verify the new messages line is not visible
        cy.get('.NotificationSeparator').should('not.exist');

        // # Click on toast pointer
        cy.get('div.toast__visible div.toast__pointer').should('be.visible').click();

        // * Verify the new messages line is visible
        cy.get('.NotificationSeparator').should('be.visible');
    });

    it('Unread messages toast should take to bottom when clicked', () => {
        cy.uiClickSidebarItem(testChannelName);

        // # Scroll up so bottom is not visible
        scrollUp();

        // # Add enough messages
        for (let index = 0; index < 10; index++) {
            cy.postMessageAs({sender: otherUser, message: `This is a message for checking action on toast [${index}]`, channelId: testChannelId});
        }

        // * Verify the toast is visible
        cy.get('div.toast').should('be.visible');

        // # Click on toast pointer
        cy.get('div.toast__visible div.toast__pointer').should('be.visible').click();

        // * Verify last posted message is in view
        cy.getLastPostId().then((postId) => {
            cy.get(`#postMessageText_${postId} > p`).should('be.visible').contains('This is a message for checking action on toast [9]');
        });
    });

    it('New message toast should be removed on clicking remove button', () => {
        cy.uiClickSidebarItem(testChannelName);
        scrollUpAndPostAMessage(otherUser, testChannelId);

        // * Verify the toast is visible
        cy.get('div.toast').should('be.visible');

        // # Click on toast dismiss button to close the toast
        cy.findByTestId('dismissToast').should('be.visible').click();

        // * Verify the toast is not visible
        cy.get('div.toast').should('not.exist');
    });

    it('Recurring visit to a channel with unreads should have unread toast', () => {
        cy.uiClickSidebarItem(testChannelName);

        // # Scroll up so bottom is not visible
        scrollUp();

        // # Click on sidebar off-topic link
        cy.get('#sidebarItem_off-topic').should('be.visible').scrollIntoView().click();

        // # Add enough messages
        for (let index = 0; index < 40; index++) {
            cy.postMessageAs({sender: otherUser, message: `This is a new message [${index}]`, channelId: testChannelId});
        }

        // # Go back
        cy.go('back');

        // # Scroll up so bottom is not visible
        scrollUp();

        // * Verify the toast is visible
        cy.get('div.toast').should('be.visible');

        // # Click on toast dismiss button to close the toast
        cy.findByTestId('dismissToast').should('be.visible').click();

        // * Verify the toast is not visible
        cy.get('div.toast').should('not.exist');
    });

    it('New message count should increase with incoming messages', () => {
        cy.uiClickSidebarItem(testChannelName);
        scrollUpAndPostAMessage(otherUser, testChannelId);

        // * Verify the toasts are visible with correct messages
        cy.get('div.toast').should('be.visible').contains('1 new message');
        cy.postMessageAs({sender: otherUser, message: 'This is another new message', channelId: testChannelId}).then(() => {
            cy.get('div.toast').should('be.visible').contains('2 new message');
        });
    });

    it('New message count should reset when dismissed', () => {
        cy.uiClickSidebarItem(testChannelName);
        scrollUpAndPostAMessage(otherUser, testChannelId);

        // * Verify the toast is visible with correct message
        cy.get('div.toast').should('be.visible').contains('1 new message');

        // # Click on toast dismiss button to close the toast
        cy.findByTestId('dismissToast').should('be.visible').click();

        // * Verify the toast is not visible
        cy.get('div.toast').should('not.exist');

        // # Post a new message
        cy.postMessageAs({sender: otherUser, message: 'This is another new message', channelId: testChannelId}).then(() => {
            // * Verify the toast is visible with correct message
            cy.get('div.toast').should('be.visible').contains('1 new message');
        });
    });

    it('Marking channel as unread should make unread toast appear', () => {
        cy.uiClickSidebarItem(testChannelName);

        // # Scroll up so bottom is not visible
        scrollUp();

        cy.getNthPostId(40).then((postId) => {
            // # Mark post as unread
            cy.uiClickPostDropdownMenu(postId, 'Mark as Unread');

            // # Visit another channel and come back to the same channel again
            cy.uiClickSidebarItem('off-topic');
            cy.get('div.post-list__dynamic').should('be.visible');
            cy.uiClickSidebarItem(testChannelName);

            // # Scroll up so bottom is not visible
            scrollUp();

            // * Verify toast is visible with correct message
            cy.get('div.toast').should('be.visible').contains('new messages today');
        });
    });

    it('New message line should move if user is scrolled up and new messages arrive', () => {
        cy.uiClickSidebarItem(testChannelName);

        // # Scroll to the bottom
        scrollDown();

        // # Post a new message
        cy.postMessageAs({sender: otherUser, message: 'post1', channelId: testChannelId}).then(() => {
            // * Verify the new messages line should appear above the last post
            cy.get('.NotificationSeparator').should('exist').parent().parent().parent().next().should('contain', 'post1');

            // # Scroll up so bottom is not visible
            scrollUp();

            // * Verify the new messages line should have moved to the last post
            cy.postMessageAs({sender: otherUser, message: 'post2', channelId: testChannelId}).then(() => {
                cy.get('.NotificationSeparator').parent().parent().parent().next().should('contain', 'post2');
            });
        });
    });

    it('Archive toast is not shown when visiting a permalink at the bottom', () => {
        // # Add one message
        cy.postMessageAs({sender: otherUser, message: 'This is a message for permalink', channelId: testChannelId}).then(({id}) => {
            cy.uiClickSidebarItem(testChannelName);

            // # Visit permalink
            cy.visit(`/${testTeam.name}/pl/${id}`);
            cy.findAllByTestId('postView').should('be.visible');

            // * Verify toast is not visible
            cy.get('div.toast').should('not.exist');
        });
    });

    it('Archive toast should be shown when visiting a post which is not at bottom', () => {
        // # Create new channel and add other user to channel
        cy.apiCreateChannel(testTeam.id, 'channel-test', 'Channel').then(({channel}) => {
            const otherChannelId = channel.id;
            cy.apiAddUserToChannel(otherChannelId, otherUser.id);

            // # Add one message
            cy.postMessageAs({sender: otherUser, message: 'This is a message for permalink', channelId: otherChannelId}).then(({id}) => {
                cy.uiClickSidebarItem(testChannelName);

                // # Add 25 posts to create enough space from bottom for showing archive toast
                for (let index = 0; index < 25; index++) {
                    cy.postMessageAs({sender: otherUser, message: `# This is an old message [${index}]`, channelId: otherChannelId});
                }

                // # Visit permalink
                cy.visit(`/${testTeam.name}/pl/${id}`);
                cy.findAllByTestId('postView').should('be.visible');

                // * Verify toast is visible with correct message
                cy.get('div.toast').should('be.visible').contains('Viewing message history');
            });
        });
    });

    it('MM-T1787 Toast does not appear when all new messages are visible without scrolling down', () => {
        // # Go to other channel
        cy.get(`#sidebarItem_${otherChannel.name}`).should('be.visible').click();

        // # Add enough messages to test channel
        for (let index = 0; index < 30; index++) {
            cy.postMessageAs({sender: otherUser, message: `This is an old message [${index}]`, channelId: testChannelId});
        }

        // # Visit test channel and read all messages
        cy.uiClickSidebarItem(testChannelName);
        cy.get('div.post-list__dynamic').should('be.visible').scrollTo('bottom', {duration: TIMEOUTS.ONE_SEC});

        // # Visit other channel
        cy.uiClickSidebarItem(otherChannel.name);

        // # Add less number of messages to town square channel
        cy.postMessageAs({sender: otherUser, message: 'This is an new message 1', channelId: testChannelId});
        cy.postMessageAs({sender: otherUser, message: 'This is an new message 2', channelId: testChannelId});

        // # Visit town square channel
        cy.uiClickSidebarItem(testChannelName);

        // * Assert toast should not be present as the messages are visible without scrolling down
        cy.get('div.toast').should('not.exist');

        // # Move to the top of the channel
        Cypress._.times(3, () => {
            cy.get('div.post-list__dynamic').should('be.visible').scrollTo('top', {duration: TIMEOUTS.ONE_SEC}).wait(TIMEOUTS.ONE_SEC);
        });

        // * Verify that test channel is loaded
        cy.get('#channelIntro').contains('Beginning of');

        // * Assert toast should not be present as the messages are already read
        cy.get('div.toast').should('not.exist');
    });

    it('MM-T1785 Toast - When marking post as unread', () => {
        cy.uiClickSidebarItem(testChannelName);

        // # Add 30 posts to create enough space from bottom for making channel scrollable
        for (let index = 0; index < 30; index++) {
            cy.postMessageAs({sender: otherUser, message: `This is an old message [${index}]`, channelId: testChannelId});
        }

        cy.getNthPostId(2).then((postId) => {
            // # Mark post as unread
            cy.uiClickPostDropdownMenu(postId, 'Mark as Unread');
        });

        // * Verify toast is visible with correct message
        cy.get('div.toast').should('be.visible').contains('new messages');

        // # Move to the channel bottom
        cy.get('div.post-list__dynamic').should('be.visible').scrollTo('bottom', {duration: TIMEOUTS.ONE_SEC});

        // # Move to the second last message in the channel and mark as unread
        cy.getNthPostId(-2).then((postId) => {
            // # Mark post as unread
            cy.uiClickPostDropdownMenu(postId, 'Mark as Unread');
        });

        // * Verify toast is not visible
        cy.get('div.toast').should('not.exist');

        // # Reload to remove new messages line
        cy.reload();
    });

    it('MM-T1788 Toast count', () => {
        // # Visit other channel
        cy.uiClickSidebarItem(otherChannel.name);

        // # Add 25 posts to create enough space from bottom for showing archive toast
        for (let index = 0; index < 25; index++) {
            cy.postMessageAs({sender: otherUser, message: `This is an old message [${index}]`, channelId: testChannelId});
        }

        cy.uiClickSidebarItem(testChannelName);

        // * Verify toast is visible with correct message
        cy.get('div.toast').should('be.visible').contains('25 new messages');

        const initialCount = 25;

        // # Add 10 messages to channel and check the toast count increases
        Cypress._.times(10, (num) => {
            cy.postMessageAs({sender: otherUser, message: `This is an old message [${initialCount + num}]`, channelId: testChannelId});

            // * Verify toast is visible with correct message
            cy.get('div.toast').should('be.visible').contains(`${initialCount + num + 1} new messages`);
        });
    });
});
