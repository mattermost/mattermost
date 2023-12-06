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

describe('Post Edit History', () => {
    let offtopiclink: string;

    before(() => {
        // # Login as test user and visit off-topic
        cy.apiInitSetup({loginAfter: true}).then(({team}) => {
            offtopiclink = `/${team.name}/channels/off-topic`;
            cy.visit(offtopiclink);
        });
    });

    beforeEach(() => {
        // * Validate if the channel has been opened
        cy.url().should('include', offtopiclink);

        // # Post a message
        cy.postMessage('This is a sample message');

        cy.getLastPostId().then((postId) => {
            editMessage(postId);
        });
    });

    it('MM-T5381_1 Show and restore older versions of a message', () => {
        // # Get the last post id
        cy.getLastPostId().then((postId) => {
            openEditHistory(postId);

            // * Check if the current version of the message is visible
            cy.get(`#rhsPostMessageText_${postId}`).should('have.text', 'This is the final version of the sample message');

            // * Check if the previous versions of the message are visible and correct in the history
            cy.get('#rhsContainer').find('.edit-post-history__container').should('have.length', 3);
            cy.get('#rhsContainer').find('.edit-post-history__container').eq(1).click();
            cy.get('#rhsContainer').find('.post-message__text').eq(1).should('have.text', 'This is an edited sample message');
            cy.get('#rhsContainer').find('.edit-post-history__container').eq(2).click();
            cy.get('#rhsContainer').find('.post-message__text').eq(2).should('have.text', 'This is a sample message');

            // # Click the restore button on the first version of the message
            cy.get('#rhsContainer').find('.restore-icon').eq(0).click();

            // # Confirm the restore
            cy.get('.confirm').click();

            // # Wait for the message to be updated
            cy.wait(TIMEOUTS.HALF_SEC);

            // * Check if the message has been updated to the first version
            cy.get(`#postMessageText_${postId}`).should('have.text', 'This is an edited sample message Edited');
        });
    });

    it('MM-T5381_2 Show, restore older versions of a message and click undo in toast', () => {
        // # Get the last post id
        cy.getLastPostId().then((postId) => {
            openEditHistory(postId);

            // # Click the restore button on the first version of the message
            cy.get('#rhsContainer').find('.restore-icon').eq(0).click();

            // # Confirm the restore
            cy.get('.confirm').click();

            // # Wait for the message to be updated
            cy.wait(TIMEOUTS.HALF_SEC);

            // # Click the undo button on the toast
            cy.get('.info-toast__undo').click();

            // # Wait for the message to be updated
            cy.wait(TIMEOUTS.HALF_SEC);

            // * Check if the message has been updated to the first version
            cy.get(`#postMessageText_${postId}`).should('have.text', 'This is the final version of the sample message Edited');
        });
    });

    it('MM-T5381_3 Edit history should not be available when user lacks edit own posts permissions', () => {
        // # Login as sysadmin and update edit own posts permissions
        cy.apiAdminLogin();
        cy.apiUpdateConfig({
            ServiceSettings: {
                PostEditTimeLimit: -1,
            },
        });
        cy.reload();

        cy.getLastPostId().then((postId) => {
            // # Click the edited indicator on the post
            cy.get(`#postEdited_${postId}`).click();

            // * Confirm edit history is not visible
            cy.get('#rhsContainer').find('.sidebar--right__title').should('not.contain.text', 'Edit History');
        });
    });
});

const editMessage = (postId: string) => {
    // # click  dot menu button
    cy.clickPostDotMenu();

    // # click edit post
    cy.get(`#edit_post_${postId}`).click();

    // # Edit the message
    cy.get('#edit_textbox').
        should('be.visible').
        and('be.focused').
        wait(TIMEOUTS.HALF_SEC).
        clear().
        type('This is an edited sample message').
        type('{enter}');

    // # click  dot menu button
    cy.clickPostDotMenu();

    // # click edit post
    cy.get(`#edit_post_${postId}`).click();

    // # Edit the message again
    cy.get('#edit_textbox').
        should('be.visible').
        and('be.focused').
        wait(TIMEOUTS.HALF_SEC).
        clear().
        type('This is the final version of the sample message').
        type('{enter}');
};

const openEditHistory = (postId: string) => {
    // # Click the edited indicator on the post
    cy.get(`#postEdited_${postId}`).click();

    // # Check if the edit history is visible
    cy.get('#rhsContainer').should('exist');
};

