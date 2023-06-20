// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Group: @channels @messaging

import * as TIMEOUTS from '../../../fixtures/timeouts';

describe('Profile popover', () => {
    const message = `Testing ${Date.now()}`;
    let testTeam;
    let testChannel;
    let testUser;
    let otherUser;

    before(() => {
        cy.apiInitSetup().then(({team, channel, user}) => {
            testTeam = team;
            testChannel = channel;
            testUser = user;

            cy.apiCreateUser().then(({user: user1}) => {
                otherUser = user1;

                cy.apiAddUserToTeam(testTeam.id, otherUser.id).then(() => {
                    cy.apiAddUserToChannel(testChannel.id, otherUser.id).then(() => {
                        // # Login as test user and visit town-square
                        cy.apiLogin(testUser);
                        cy.visit(`/${testTeam.name}/channels/${testChannel.name}`);

                        // # Post a message from the other user
                        cy.postMessageAs({sender: otherUser, message, channelId: testChannel.id}).wait(TIMEOUTS.FIVE_SEC);
                    });
                });
            });
        });
    });

    it('MM-T3310 Send message in profile popover take to DM channel', () => {
        cy.waitUntil(() => cy.getLastPost().then((el) => {
            const postedMessageEl = el.find('.post-message__text > p')[0];
            return Boolean(postedMessageEl && postedMessageEl.textContent.includes(message));
        }));

        cy.getLastPostId().then((lastPostId) => {
            // # On default viewport width of 1300
            // # Click profile icon to open profile popover. Click "Message" and verify redirects to DM channel
            verifyDMChannelViaSendMessage(lastPostId, testTeam, testChannel, '.status-wrapper', otherUser);

            // # Click username to open profile popover. Click "Message" and verify redirects to DM channel
            verifyDMChannelViaSendMessage(lastPostId, testTeam, testChannel, '.user-popover', otherUser);

            // # On mobile view
            cy.viewport('iphone-6');

            // # Click profile icon to open profile popover. Click "Message" and verify redirects to DM channel
            verifyDMChannelViaSendMessage(lastPostId, testTeam, testChannel, '.status-wrapper', otherUser);

            // # Click username to open profile popover. Click "Message" and verify redirects to DM channel
            verifyDMChannelViaSendMessage(lastPostId, testTeam, testChannel, '.user-popover', otherUser);
        });
    });
});

function verifyDMChannelViaSendMessage(postId, team, channel, profileSelector, user) {
    // # Go to default town-square channel
    cy.visit(`/${team.name}/channels/${channel.name}`);

    // # Visit post thread on RHS and verify that RHS is opened
    cy.clickPostCommentIcon(postId);
    cy.get('#rhsContainer').should('be.visible');

    // # Open profile popover with the given selector
    cy.wait(TIMEOUTS.HALF_SEC);
    cy.get(`#rhsPost_${postId}`).should('be.visible').within(() => {
        cy.get(profileSelector).should('be.visible').click();
    });

    // * Verify that profile popover is opened
    cy.wait(TIMEOUTS.HALF_SEC);
    cy.get('#user-profile-popover').should('be.visible').within(() => {
        // # Click "Message" on profile popover
        cy.findByText('Message').should('be.visible').click();
    });

    // * Verify that profile popover is closed
    cy.wait(TIMEOUTS.HALF_SEC);
    cy.get('#user-profile-popover').should('not.exist');

    // * Verify that it redirects into the DM channel and matches channel intro
    cy.get('#channelIntro').should('be.visible').within(() => {
        cy.url().should('include', `/${team.name}/messages/@${user.username}`);
        cy.get('.channel-intro-profile').
            should('be.visible').
            and('have.text', user.username);
        cy.get('.channel-intro-text').
            should('be.visible').
            and('contain', `This is the start of your direct message history with ${user.username}.`).
            and('contain', 'Direct messages and files shared here are not shown to people outside this area.');
    });
}
