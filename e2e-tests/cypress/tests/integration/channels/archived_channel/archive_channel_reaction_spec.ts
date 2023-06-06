// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @channel

import * as TIMEOUTS from '../../../fixtures/timeouts';

describe('Archived channels', () => {
    before(() => {
        cy.apiUpdateConfig({
            TeamSettings: {
                ExperimentalViewArchivedChannels: true,
            },
        });

        // # Login as test user and visit created channel
        cy.apiInitSetup({loginAfter: true}).then(({team, channel}) => {
            cy.visit(`/${team.name}/channels/${channel.name}`);
        });
    });

    it('MM-T1718 Reaction icon should not be visible for archived channel posts', () => {
        const messageText = 'Test archive reaction';

        // # Post a message in the channel
        cy.postMessage(messageText);

        // # Get the last post for reference of ID
        cy.getLastPostId().then((postId) => {
            // # Click on post dot menu so we can check for reaction icon
            cy.clickPostDotMenu();

            // * Reaction icon should be visible as channel is not archived
            cy.wait(TIMEOUTS.HALF_SEC).get(`#CENTER_reaction_${postId}`).should('be.visible');

            // # Archive the channel
            cy.uiArchiveChannel();

            // # Click on post dot menu so we can check for reaction icon
            cy.clickPostDotMenu(postId);

            // * Reaction icon on center channel post should not be visible anymore
            cy.wait(TIMEOUTS.HALF_SEC).get(`#CENTER_reaction_${postId}`).should('not.exist');

            // # Remove focus so we can open RHS
            cy.get('#channel_view').click();

            // # Open RHS for the post
            cy.clickPostCommentIcon(postId);

            // # Click on post dot menu so we can check for reaction icon
            cy.clickPostDotMenu(postId, 'RHS_ROOT');

            // * Reaction icon on post in RHS should not be visible anymore
            cy.wait(TIMEOUTS.HALF_SEC).get(`#RHS_ROOT_reaction_${postId}`).should('not.exist');

            // # Search for "Test archive reaction"
            cy.get('#searchBox').should('be.visible').type(messageText).type('{enter}');

            // # Click on post dot menu so we can check for reaction icon
            cy.clickPostDotMenu(postId, 'SEARCH');

            // * Reaction icon on post in search results should not be visible anymore
            cy.wait(TIMEOUTS.HALF_SEC).get(`#searchResult_reaction_${postId}`).should('not.exist');
        });
    });
});
