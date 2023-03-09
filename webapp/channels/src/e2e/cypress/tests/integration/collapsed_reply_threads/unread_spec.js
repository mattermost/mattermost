// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @collapsed_reply_threads

import * as TIMEOUTS from '../../fixtures/timeouts';

describe('Collapsed Reply Threads', () => {
    let testTeam;
    let testUser;
    let otherUser;
    let testChannel;

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
            cy.get('#rhsContainer').findByTestId('NotificationSeparator').should('be.visible');

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
});
