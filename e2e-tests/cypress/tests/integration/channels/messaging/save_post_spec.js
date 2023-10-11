// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// [#] indicates a test step (e.g. # Go to a page)
// [*] indicates an assertion (e.g. * Check the title)
// Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @messaging

import {verifySavedPost, verifyUnsavedPost} from '../../../support/ui/post';

describe('Save Post', () => {
    before(() => {
        cy.apiInitSetup().then(({channelUrl}) => {
            // # Go to test channel
            cy.visit(channelUrl);
        });
    });

    it('MM-T4948_1 Save menu item should save post', () => {
        // # Post a message
        const message = Date.now().toString();
        cy.postMessage(message);
        cy.getLastPostId().as('postId1');

        // # Post several messages so that dropdown menu can be seen when rendered at the bottom (Cypress limitation)
        Cypress._.times(10, (n) => {
            cy.uiPostMessageQuickly(n);
        });

        cy.get('@postId1').then((postId) => {
            // # Save message by clicking the menu item in the dotmenu
            cy.uiClickPostDropdownMenu(postId, 'Save');

            // * Assert the post pre-header is displayed and works as expected
            verifySavedPost(postId, message);

            // # Remove post from saved by clicking the menu item in the dotmenu
            cy.uiClickPostDropdownMenu(postId, 'Remove from Saved');

            // * Assert the post is removed from the saved posts list
            verifyUnsavedPost(postId);
        });
    });

    it('MM-T4948_2 Save hotkey should save post', () => {
        // # Post a message
        const message = Date.now().toString();
        cy.postMessage(message);
        cy.getLastPostId().as('postId2');

        // # Post several messages so that dropdown menu can be seen when rendered at the bottom (Cypress limitation)
        Cypress._.times(10, (n) => {
            cy.uiPostMessageQuickly(n);
        });

        cy.get('@postId2').then((postId) => {
            // # Open the post dotmenu
            cy.clickPostDotMenu(postId, 'CENTER');

            // # Press s to save
            cy.get('body').type('s');

            // * Assert the post pre-header is displayed and works as expected
            verifySavedPost(postId, message);

            // # Open the post dotmenu again
            cy.clickPostDotMenu(postId, 'CENTER');

            // # Press s again to unsave
            cy.get('body').type('s');

            // * Assert the post is removed from the saved posts list
            verifyUnsavedPost(postId);
        });
    });
});
