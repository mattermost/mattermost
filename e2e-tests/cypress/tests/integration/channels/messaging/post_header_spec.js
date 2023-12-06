// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @messaging

import * as TIMEOUTS from '../../../fixtures/timeouts';

describe('Post Header', () => {
    let testTeam;

    before(() => {
        // # Login as test user and visit town-square channel
        cy.apiInitSetup({loginAfter: true}).then(({team}) => {
            testTeam = team;

            cy.visit(`/${testTeam.name}/channels/off-topic`);
        });
    });

    beforeEach(() => {
        cy.visit(`/${testTeam.name}/channels/off-topic`);
    });

    it('should render permalink view on click of post timestamp at center view', () => {
        // # Post a message
        cy.postMessage('test for permalink');

        cy.getLastPostId().then((postId) => {
            const divPostId = `#post_${postId}`;

            // * Check initial state that the first message posted is not highlighted
            cy.get(divPostId).should('be.visible').should('not.have.class', 'post--highlight');

            // # Click timestamp of a post
            cy.clickPostTime(postId);

            // * Check if url include the permalink
            cy.url().should('include', `/${testTeam.name}/channels/off-topic/${postId}`);

            // * Check if url redirects back to parent path eventually
            cy.wait(TIMEOUTS.FIVE_SEC).url().should('include', `/${testTeam.name}/channels/off-topic`).and('not.include', `/${postId}`);

            // * Check that the post is highlighted on permalink view
            cy.get(divPostId).should('be.visible').and('have.class', 'post--highlight');

            // * Check that the highlight is removed after a period of time
            cy.wait(TIMEOUTS.HALF_SEC).get(divPostId).should('be.visible').and('not.have.class', 'post--highlight');

            // * Check the said post not highlighted
            cy.get(divPostId).should('be.visible').should('not.have.class', 'post--highlight');
        });
    });

    it('should open dropdown menu on click of dot menu icon', () => {
        // # Post a message
        cy.postMessage('test for dropdown menu');

        cy.getLastPostId().then((postId) => {
            // * Check that the center dot menu' button and dropdown are hidden
            cy.get(`#post_${postId}`).should('be.visible');
            cy.get(`#CENTER_button_${postId}`).should('not.be.visible');
            cy.get(`#CENTER_dropdown_${postId}`).should('not.exist');

            // # Click dot menu of a post
            cy.clickPostDotMenu(postId);

            // * Check that the center dot menu button and dropdown are visible
            cy.get(`#post_${postId}`).should('be.visible');
            cy.get(`#CENTER_button_${postId}`).should('be.visible');
            cy.get(`#CENTER_dropdown_${postId}`).should('be.visible').type('{esc}');

            // # Click to other location like post textbox
            cy.uiGetPostTextBox().click();

            // * Check that the center dot menu and dropdown are hidden
            cy.get(`#post_${postId}`).should('be.visible');
            cy.get(`#CENTER_button_${postId}`).should('not.be.visible');
            cy.get(`#CENTER_dropdown_${postId}`).should('not.exist');
        });
    });

    it('should open and close Emoji Picker on click of reaction icon', () => {
        // # Post a message
        cy.postMessage('test for reaction and emoji picker');

        cy.getLastPostId().then((postId) => {
            // * Check that the center post reaction icon and emoji picker are not visible
            cy.get(`#CENTER_reaction_${postId}`).should('not.be.visible');
            cy.get('#emojiPicker').should('not.exist');

            // # Click the center post reaction icon of the post
            cy.clickPostReactionIcon(postId);

            // * Check that the center post reaction icon of the post becomes visible
            cy.get(`#CENTER_reaction_${postId}`).should('be.visible').and('have.class', 'post-menu__item--active').and('have.class', 'post-menu__item--reactions');

            // * Check that the emoji picker becomes visible as well
            cy.get('#emojiPicker').should('be.visible');

            // # Click again the center post reaction icon of the post
            cy.clickPostReactionIcon(postId);

            // # Click on textbox to focus away from emoji area
            cy.uiGetPostTextBox().click();

            // * Check that the center post reaction icon and emoji picker are not visible
            cy.get(`#CENTER_reaction_${postId}`).should('not.be.visible');
            cy.get('#emojiPicker').should('not.exist');
        });
    });

    it('should open RHS on click of comment icon and close on RHS\' close button', () => {
        // # Post a message
        cy.postMessage('test for opening and closing RHS');

        // # Open RHS on hover to a post and click to its comment icon
        cy.clickPostCommentIcon();

        // * Check that the RHS is open
        cy.get('#rhsContainer').should('be.visible');

        // # Close RHS on click of close button
        cy.uiCloseRHS();

        // * Check that the RHS is close
        cy.get('#rhsContainer').should('not.exist');
    });

    it('MM-T122 Visual verification of "Searching" animation for Saved and Pinned posts', () => {
        cy.delayRequestToRoutes(['pinned', 'flagged'], 5000);
        cy.reload();

        // Pin and save last post before clicking on Pinned and Saved post icons
        cy.postMessage('Post');

        //Pin and save the posted message
        cy.getLastPostId().then((postId) => {
            cy.clickPostDotMenu(postId);
            cy.get(`#pin_post_${postId}`).click();
            cy.clickPostSaveIcon(postId);
        });

        // # Click on the "Pinned Posts" icon to the left of the "Search" box
        cy.uiGetChannelPinButton().click();

        // * Verify that the RHS for pinned posts is opened.
        cy.get('#searchContainer').should('be.visible').within(() => {
            // * Check that searching indicator appears before the pinned posts are loaded
            cy.get('#loadingSpinner', {timeout: TIMEOUTS.FIVE_SEC}).should('be.visible').and('have.text', 'Searching...');
            cy.get('#search-items-container').should('be.visible');

            // # Close the RHS
            cy.get('#searchResultsCloseButton').should('be.visible').click();
        });

        // # Click on the "Saved Posts" icon to the right of the "Search" box
        cy.uiGetSavedPostButton().click();

        // * Verify that the RHS for saved posts is opened.
        cy.get('#searchContainer').should('be.visible').within(() => {
            // * Check that searching indicator appears before the pinned posts are loaded
            cy.get('#loadingSpinner').should('be.visible').and('have.text', 'Searching...');
            cy.get('#search-items-container').should('be.visible');

            // # Close the RHS
            cy.get('#searchResultsCloseButton').should('be.visible').click();
        });
    });
});
