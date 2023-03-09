// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @messaging

import * as TIMEOUTS from '../../fixtures/timeouts';

describe('Message permalink', () => {
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
                    // # Login as test user and create DM with other user
                    cy.apiLogin(testUser);
                    cy.apiCreateDirectChannel([testUser.id, otherUser.id]);
                });
            });
        });
    });

    beforeEach(() => {
        cy.visit(`/${testTeam.name}/messages/@${otherUser.username}`);
    });

    it('MM-T177 Copy a permalink and paste into another channel', () => {
        // # Post message to use
        const message = 'Hello' + Date.now();
        cy.postMessage(message);

        cy.getLastPostId().then((postId) => {
            const permalink = `${Cypress.config('baseUrl')}/${testTeam.name}/pl/${postId}`;

            // # Check if ... button is visible in last post right side
            cy.get(`#CENTER_button_${postId}`).should('not.be.visible');

            // # Click on ... button of last post
            cy.clickPostDotMenu(postId);

            // # Click on "Copy Link"
            cy.uiClickCopyLink(permalink, postId);

            const dmChannelLink = `/${testTeam.name}/messages/@${otherUser.username}`;
            cy.apiSaveMessageDisplayPreference('compact');
            verifyPermalink(message, testChannel, permalink, postId, dmChannelLink);

            cy.apiSaveMessageDisplayPreference('clean');
            verifyPermalink(message, testChannel, permalink, postId, dmChannelLink);
        });
    });

    it('Permalink highlight should fade after timeout and change to channel url', () => {
        // # Post message to use
        const message = 'Hello' + Date.now();
        cy.postMessage(message);

        cy.getLastPostId().then((postId) => {
            const link = `/${testTeam.name}/messages/@${otherUser.username}/${postId}`;
            cy.visit(link);
            cy.url().should('include', link);
            cy.get(`#post_${postId}`, {timeout: TIMEOUTS.HALF_MIN}).should('have.class', 'post--highlight');
            cy.clock();
            cy.tick(6000);
            cy.get(`#post_${postId}`).should('not.have.class', 'post--highlight');
            cy.url().should('not.include', postId);
        });
    });
});

function verifyPermalink(message, testChannel, permalink, postId, dmChannelLink) {
    // # Click on test public channel
    cy.get('#sidebarItem_' + testChannel.name).click({force: true});
    cy.wait(TIMEOUTS.HALF_SEC);

    // # Paste link on postlist area
    cy.postMessage(permalink);

    // # Get last post id from that postlist area
    cy.getLastPostId().then((id) => {
        // # Click on permalink
        cy.get(`#postMessageText_${id} > p > .markdown__link`).scrollIntoView().click();

        // # Check if url include the permalink
        cy.url().should('include', `${dmChannelLink}/${postId}`);

        // * Check if url redirects back to parent path eventually
        cy.wait(TIMEOUTS.FIVE_SEC).url().should('include', dmChannelLink).and('not.include', `/${postId}`);
    });

    // # Get last post id from open channel
    cy.getLastPostId().then((clickedpostid) => {
        // # Check the sent message
        cy.get(`#postMessageText_${clickedpostid}`).should('be.visible').and('have.text', message);
    });
}
