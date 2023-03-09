// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @toast

import * as TIMEOUTS from '../../fixtures/timeouts';

import {scrollToTop} from './helpers';

describe('unread_with_bottom_start_toast', () => {
    let otherUser;
    let testTeam;

    before(() => {
        // # Create other user
        cy.apiCreateUser().then(({user}) => {
            otherUser = user;
        });

        // # Build data to test and login as testUser
        cy.apiInitSetup().then(({team, user}) => {
            testTeam = team;

            cy.apiAddUserToTeam(testTeam.id, otherUser.id);
            cy.apiLogin(user);
            cy.apiSaveUnreadScrollPositionPreference(user.id, 'start_from_newest');
        });
    });

    it('MM-T4873_1 Unread with bottom start toast is shown when visiting a channel with unreads and should disappear if scrolled to new messages indicator', () => {
        cy.apiCreateChannel(testTeam.id, 'channel-a', 'ChannelA').then(({channel}) => {
            cy.apiAddUserToChannel(channel.id, otherUser.id).then(() => {
                cy.visit(`/${testTeam.name}/channels/${channel.name}`);
                cy.uiClickSidebarItem('off-topic');
                cy.postMessage('hi');

                // # Add enough messages
                for (let index = 0; index < 30; index++) {
                    cy.postMessageAs({sender: otherUser, message: `test message ${index}`, channelId: channel.id});
                }

                cy.postMessage('hello');

                // # Switch to test channel
                cy.uiClickSidebarItem(channel.name).wait(TIMEOUTS.HALF_SEC);

                // * Verify the newest message is visible
                cy.get('div.post__content').contains('test message 29').should('be.visible');

                // * Verify the toast is visible with correct message
                cy.get('div.toast').should('be.visible').contains('30 new messages');

                // # Scroll to the new messages indicator
                cy.get('.NotificationSeparator').should('exist').scrollIntoView({offset: {top: -150}});

                // * Verify toast jump is not visible
                cy.get('div.toast__jump').should('not.exist');

                // * Verify toast is not visible
                cy.get('div.toast').should('not.exist');
            });
        });
    });

    it('MM-T4873_2 Unread with bottom start toast should take to the new messages indicator when clicked', () => {
        cy.apiCreateChannel(testTeam.id, 'channel-b', 'ChannelB').then(({channel}) => {
            cy.apiAddUserToChannel(channel.id, otherUser.id).then(() => {
                cy.visit(`/${testTeam.name}/channels/${channel.name}`);
                cy.uiClickSidebarItem('off-topic');
                cy.postMessage('hi');

                // # Add enough messages
                for (let index = 0; index < 30; index++) {
                    cy.postMessageAs({sender: otherUser, message: `test message ${index}`, channelId: channel.id});
                }

                cy.postMessage('hello');

                // # Visit test channel
                cy.uiClickSidebarItem(channel.name).wait(TIMEOUTS.HALF_SEC);

                // * Verify the toast is visible with correct message
                cy.get('div.toast').should('be.visible').contains('30 new messages');

                // # Click on toast pointer
                cy.get('div.toast__visible div.toast__pointer').should('be.visible').click();

                // * Verify toast jump is not visible
                cy.get('div.toast__jump').should('not.exist');

                // * Verify toast is not visible
                cy.get('div.toast').should('not.exist');

                // * Verify new messages indicator is visible
                cy.get('.NotificationSeparator').should('be.visible');
            });
        });
    });

    it('MM-T4873_3 Unread with bottom start toast is shown when post is marked as unread', () => {
        cy.apiCreateChannel(testTeam.id, 'channel-c', 'ChannelC').then(({channel}) => {
            cy.apiAddUserToChannel(channel.id, otherUser.id).then(() => {
                cy.visit(`/${testTeam.name}/channels/${channel.name}`);

                // # Add enough messages
                for (let index = 0; index < 30; index++) {
                    cy.postMessageAs({sender: otherUser, message: `test message ${index}`, channelId: channel.id});
                }

                cy.wait(TIMEOUTS.ONE_SEC);

                // # Scroll to the top to find the oldest message
                scrollToTop();

                cy.getNthPostId(1).then((postId) => {
                    // # Mark post as unread
                    cy.uiClickPostDropdownMenu(postId, 'Mark as Unread');
                });

                // # Visit off-topic channel and switch back to test channel
                cy.uiClickSidebarItem('off-topic');
                cy.uiClickSidebarItem(channel.name);

                // * Verify toast is visible
                cy.get('div.toast').should('be.visible').contains('30 new messages');

                // # Click on toast pointer
                cy.get('div.toast__visible div.toast__pointer').should('be.visible').click();

                // * Verify unread marked post is visible
                cy.get('div.post__content').contains('test message 0').should('be.visible');

                // * Verify new messages indicator is visible
                cy.get('.NotificationSeparator').should('be.visible');
            });
        });
    });
});
