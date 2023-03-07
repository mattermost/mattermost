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

describe('Remove Last Post', () => {
    let testTeam;
    let testUser;
    let otherUser;

    before(() => {
        cy.apiInitSetup().then(({team, channel, user}) => {
            testTeam = team;
            testUser = user;

            cy.apiCreateUser().then(({user: user1}) => {
                otherUser = user1;

                cy.apiAddUserToTeam(testTeam.id, otherUser.id).then(() => {
                    cy.apiAddUserToChannel(channel.id, otherUser.id);

                    // # Login as test user and start DM with the other user
                    cy.apiLogin(testUser);
                    cy.visit(`/${testTeam.name}/messages/@${otherUser.username}`);
                });
            });
        });
    });

    it('MM-T218 Remove last post in channel', () => {
        // # Wait a few ms for the user to be created before sending the test message
        cy.wait(TIMEOUTS.FIVE_SEC);

        // # Post test message
        cy.postMessage('Test');

        cy.getLastPostId().then((postId) => {
            cy.clickPostDotMenu(postId);

            // # Delete the last post
            cy.get(`#delete_post_${postId}`).click();

            // # Confirm deletion
            cy.get('#deletePostModalButton').click();

            // * Check that the user has not been re-directed to another channel
            const baseUrl = Cypress.config('baseUrl');
            cy.url().should('eq', `${baseUrl}/${testTeam.name}/messages/@${otherUser.username}`);
        });
    });
});
