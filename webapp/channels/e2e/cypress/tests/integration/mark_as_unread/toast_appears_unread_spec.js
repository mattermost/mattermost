// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @mark_as_unread

import {markAsUnreadFromPost, switchToChannel} from './helpers';

describe('Verify unread toast appears after repeated manual marking post as unread', () => {
    let firstPost;
    let secondPost;

    const offTopicChannel = {name: 'off-topic', display_name: 'Off-Topic'};
    let testChannel;

    before(() => {
        cy.apiInitSetup().then(({team, user, channel}) => {
            testChannel = channel;

            cy.apiCreateUser({prefix: 'other'}).then(({user: otherUser}) => {
                cy.apiAddUserToTeam(team.id, otherUser.id).then(() => {
                    cy.apiAddUserToChannel(testChannel.id, otherUser.id);

                    // Toast only seems to appear after first visiting the channel
                    // So we need to visit the channel then navigate away
                    cy.apiLogin(user);
                    cy.visit(`/${team.name}/channels/${testChannel.name}`);
                    switchToChannel(offTopicChannel);

                    cy.postMessageAs({
                        sender: otherUser,
                        message: 'First message',
                        channelId: testChannel.id,
                    }).then((post) => {
                        firstPost = post;

                        cy.postMessageAs({
                            sender: otherUser,
                            message: 'Second message',
                            channelId: testChannel.id,
                        }).then((post2) => {
                            secondPost = post2;

                            // Add posts so that scroll is available
                            Cypress._.times(30, (index) => {
                                cy.postMessageAs({
                                    sender: otherUser,
                                    message: `${index.toString()}\nsecond line\nthird line\nfourth line`,
                                    channelId: testChannel.id,
                                });
                            });
                        });
                    });
                });
            });
        });
    });

    it('MM-T1429 Toast when navigating to channel with unread messages and after repeated marking as unread', () => {
        // # Switch to town square channel that has unread messages
        switchToChannel(testChannel);

        // * Check that the toast is visible
        cy.get('div.toast').should('be.visible');

        // # Scroll to the bottom of the posts
        cy.get('.post-list__dynamic').scrollTo('bottom');

        // * Check that the toast is not visible
        cy.get('div.toast').should('not.exist');

        // # Mark the first post as unread
        markAsUnreadFromPost(firstPost);

        // * Check that the toast is now visible
        cy.get('div.toast').should('be.visible');

        // # Scroll to the bottom of the posts
        cy.get('.post-list__dynamic').scrollTo('bottom');

        // * Check that the toast is not visible
        cy.get('div.toast').should('not.exist');

        // # Mark the second post as unread
        markAsUnreadFromPost(secondPost);

        // * Check that the toast is now visible
        cy.get('div.toast').should('be.visible');

        // # Switch channels
        switchToChannel(offTopicChannel);

        // * Check that the toast is not visible
        cy.get('div.toast').should('not.exist');

        // # Switch channels back
        switchToChannel(testChannel);

        // * Check that the toast is now visible
        cy.get('div.toast').should('be.visible');
    });
});
