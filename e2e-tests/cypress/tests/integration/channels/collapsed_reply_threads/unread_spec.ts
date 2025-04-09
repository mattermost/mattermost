// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @collapsed_reply_threads

import {Channel} from '@mattermost/types/channels';
import {Team} from '@mattermost/types/teams';
import {UserProfile} from '@mattermost/types/users';
import * as TIMEOUTS from '../../../fixtures/timeouts';

describe('Collapsed Reply Threads', () => {
    let testTeam: Team;
    let testUser: UserProfile;
    let otherUser: UserProfile;
    let testChannel: Channel;

    before(() => {
        cy.apiUpdateConfig({
            ServiceSettings: {
                ThreadAutoFollow: true,
                CollapsedThreads: 'default_off',
            },
        });

        // # Create new channel and other user, and add other user to channel
        cy.apiInitSetup({loginAfter: true, promoteNewUserAsAdmin: true}).then(({team, channel, user}) => {
            testTeam = team;
            testUser = user;
            testChannel = channel;

            cy.apiSaveCRTPreference(testUser.id, 'on');

            cy.apiCreateUser({prefix: 'other'}).then(({user: user1}) => {
                otherUser = user1;

                cy.apiAddUserToTeam(testTeam.id, otherUser.id).then(() => {
                    cy.apiAddUserToChannel(testChannel.id, otherUser.id);
                });
            });
        });
    });

    beforeEach(() => {
        // # Visit channel
        cy.visit(`/${testTeam.name}/channels/${testChannel.name}`);
    });

    it('MM-T4144_1 should show a new messages line for an unread thread', () => {
        // # Post a root post as current user
        cy.postMessageAs({
            sender: testUser,
            message: 'Another interesting post,',
            channelId: testChannel.id,
        }).then(({id: rootId}) => {
            // # Post multiple replies as other user so that the new messages line is pushed up
            Cypress._.times(20, (i) => {
                cy.postMessageAs({
                    sender: otherUser,
                    message: 'Reply ' + i,
                    channelId: testChannel.id,
                    rootId,
                });
            });

            // # Click root post
            cy.get(`#post_${rootId}`).click();

            // # Wait for RHS to open and scroll to position
            cy.wait(TIMEOUTS.ONE_SEC);

            // * RHS should open and new messages line should be visible
            cy.get('#rhsContainer').findByTestId('NotificationSeparator').scrollIntoView().should('be.visible');

            // # Close RHS
            cy.uiCloseRHS();
        });
    });

    it('MM-T4144_2 should not show a new messages line after viewing the thread', () => {
        // # Get last message in channel
        cy.getLastPostId().then((rootId) => {
            // # Click on message
            cy.get(`#post_${rootId}`).click();

            // * RHS should open and new messages line should NOT be visible
            cy.get('#rhsContainer').findByTestId('NotificationSeparator').should('not.exist');

            // # Close RHS
            cy.uiCloseRHS();
        });
    });

    it('MM-T5671 should handle mention counts correctly when marking a thread as unread and unfollowing it', () => {
        // # Post a root post as current user
        cy.postMessageAs({
            sender: otherUser,
            message: `@${testUser.username} Root post for mention test`,
            channelId: testChannel.id,
        }).then(({id: rootId}) => {
            // # Post a reply mentioning the user
            cy.postMessageAs({
                sender: otherUser,
                message: `Hey @${testUser.username}, check this out!`,
                channelId: testChannel.id,
                rootId,
            }).then(({id: replyId}) => {
                // # Post another reply mentioning the user
                cy.postMessageAs({
                    sender: otherUser,
                    message: `Hey @${testUser.username}, check this out too!`,
                    channelId: testChannel.id,
                    rootId,
                });

                // # Click root post to open RHS
                cy.get(`#post_${rootId}`).click();

                // # Wait for RHS to open
                cy.wait(TIMEOUTS.ONE_SEC);

                // # Mark the thread as unread
                cy.uiClickPostDropdownMenu(replyId, 'Mark as Unread', 'RHS_COMMENT');

                // # Wait for unread to be marked correctly
                cy.wait(TIMEOUTS.ONE_SEC);

                // # Close RHS
                cy.uiCloseRHS();

                // # Switch to a different team
                cy.apiCreateTeam('team', 'Team').then(({team: otherTeam}) => {
                    // # Click on the other team button to switch teams
                    cy.get(`#${otherTeam.name}TeamButton`).click();

                    // * Verify mention count on the original team
                    cy.get(`#${testTeam.name}TeamButton`).find('.badge').should('be.visible');

                    // # Click on the original team button to switch back
                    cy.get(`#${testTeam.name}TeamButton`).click();

                    // # Unfollow the thread
                    cy.uiGetPostThreadFooter(rootId).findByText('Following').click();

                    // # Switch to a different team and back
                    cy.get(`#${otherTeam.name}TeamButton`).click();
                    cy.get(`#${testTeam.name}TeamButton`).click();
                    cy.get(`#${otherTeam.name}TeamButton`).click();

                    // * Verify there is no mention count on the original team
                    cy.get(`#${testTeam.name}TeamButton`).find('.badge').should('not.exist');
                });
            });
        });
    });
});
