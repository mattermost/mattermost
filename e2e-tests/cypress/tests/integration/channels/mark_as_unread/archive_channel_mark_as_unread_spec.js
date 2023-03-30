// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @mark_as_unread

import {notShowCursor, markAsUnreadShouldBeAbsent} from './helpers';

describe('Channels', () => {
    let testUser;
    let testChannel;
    let testTeam;
    let post1;

    before(() => {
        // # Enable Experimental View Archived Channels
        cy.apiUpdateConfig({
            TeamSettings: {
                ExperimentalViewArchivedChannels: true,
            },
        });

        cy.apiInitSetup().then(({team, user}) => {
            testUser = user;
            testTeam = team;

            // # Create a test channel
            cy.apiCreateChannel(team.id, 'channel-test', 'Channel').then(({channel}) => {
                testChannel = channel;

                // # Create second user and add him to the team
                cy.apiCreateUser().then(({user: user2}) => {
                    const otherUser = user2;

                    cy.apiAddUserToTeam(team.id, otherUser.id).then(() => {
                        cy.apiAddUserToChannel(testChannel.id, otherUser.id);

                        // Another user creates posts in the channel since you can't mark your own posts unread currently
                        cy.postMessageAs({sender: otherUser, message: 'post1', channelId: testChannel.id}).then((p1) => {
                            post1 = p1;
                        });
                    });
                });
            });
        });
    });
    it('MM-T263 Mark as Unread post menu option should not be available for archived channels', () => {
        // # Login as testUser
        cy.apiLogin(testUser);

        // # Visit the channel
        cy.visit(`/${testTeam.name}/channels/${testChannel.name}`);

        // # Click channel header to open channel menu
        cy.get('#channelHeaderTitle').should('contain', testChannel.display_name).click();

        // * Verify that the menu is opened
        cy.get('.Menu__content').should('be.visible').within(() => {
            // # Archive the channel
            cy.findByText('Archive Channel').should('be.visible').click();
        });

        // * Verify that the delete/archive channel modal is opened
        cy.get('#deleteChannelModal').should('be.visible').within(() => {
            // # Confirm archive
            cy.findByText('Archive').should('be.visible').click();
        });

        // * Verify the "Mark as Unread" option is absent in post menu
        markAsUnreadShouldBeAbsent(post1.id);

        // * Hover on the post with holding alt should show cursor
        cy.get(`#post_${post1.id}`).trigger('mouseover').type('{alt}', {release: false}).should(notShowCursor);

        // # Mouse click on the post holding alt
        cy.get(`#post_${post1.id}`).type('{alt}', {release: false}).click();

        // * Verify the post is not marked as unread
        cy.get('.NotificationSeparator').should('not.exist');
    });
});

