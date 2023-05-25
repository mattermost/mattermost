// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {ChainableT} from '../../types';

function uiGetPostTextBox(option = {exist: true}): ChainableT<JQuery> {
    if (option.exist) {
        return cy.get('#post_textbox').should('be.visible');
    }

    return cy.get('#post_textbox').should('not.exist');
}
Cypress.Commands.add('uiGetPostTextBox', uiGetPostTextBox);

function uiGetReplyTextBox(option = {exist: true}): ChainableT<JQuery> {
    if (option.exist) {
        return cy.get('#reply_textbox').should('be.visible');
    }

    return cy.get('#reply_textbox').should('not.exist');
}
Cypress.Commands.add('uiGetReplyTextBox', uiGetReplyTextBox);

function uiGetPostProfileImage(postId: string): ChainableT<JQuery> {
    return getPost(postId).within(() => {
        return cy.get('.post__img').should('be.visible');
    });
}
Cypress.Commands.add('uiGetPostProfileImage', uiGetPostProfileImage);

function uiGetPostHeader(postId: string): ChainableT<JQuery> {
    return getPost(postId).within(() => {
        return cy.get('.post__header').should('be.visible');
    });
}
Cypress.Commands.add('uiGetPostHeader', uiGetPostHeader);

function uiGetPostBody(postId: string): ChainableT<JQuery> {
    return getPost(postId).within(() => {
        return cy.get('.post__body').should('be.visible');
    });
}
Cypress.Commands.add('uiGetPostBody', uiGetPostBody);

function uiGetPostThreadFooter(postId: string): ChainableT<JQuery> {
    return getPost(postId).find('.ThreadFooter');
}
Cypress.Commands.add('uiGetPostThreadFooter', uiGetPostThreadFooter);

function uiGetPostEmbedContainer(postId: string): ChainableT<JQuery> {
    return cy.uiGetPostBody(postId).
        find('.file-preview__button').
        should('be.visible');
}
Cypress.Commands.add('uiGetPostEmbedContainer', uiGetPostEmbedContainer);

function getPost(postId: string): ChainableT<JQuery> {
    if (postId) {
        return cy.get(`#post_${postId}`).should('be.visible');
    }

    return cy.getLastPost();
}
Cypress.Commands.add('getPost', getPost);

export function verifySavedPost(postId, message) {
    // * Check that the center save icon has been updated correctly
    cy.get(`#post_${postId}`).trigger('mouseover', {force: true});
    cy.get(`#CENTER_flagIcon_${postId}`).
        should('have.class', 'post-menu__item').
        and('have.attr', 'aria-label', 'remove from saved');

    // # Open the post-dotmenu
    cy.clickPostDotMenu(postId, 'CENTER');

    // * Check that the dotmenu item is changed accordingly
    cy.findAllByTestId(`post-menu-${postId}`).eq(0).should('be.visible');
    cy.findByText('Remove from Saved').scrollIntoView().should('be.visible');
    cy.get(`#CENTER_dropdown_${postId}`).should('be.visible').type('{esc}');

    // * Check that the post is highlighted
    cy.get(`#post_${postId}`).should('have.class', 'post--pinned-or-flagged');

    // * Check that the post pre-header is visible
    cy.get('div.post-pre-header').should('be.visible');

    // * Check that the post pre-header has the saved icon
    cy.get('span.icon--post-pre-header').
        should('be.visible').
        within(() => {
            cy.get('svg').should('have.attr', 'aria-label', 'Saved Icon');
        });

    // * Check that the post pre-header has the saved post link
    cy.get('div.post-pre-header__text-container').
        should('be.visible').
        and('have.text', 'Saved').
        within(() => {
            cy.get('a').as('savedLink').should('be.visible');
        });

    // * Check that the saved posts list is not open in RHS before clicking the link in the post pre-header
    cy.get('#searchContainer').should('not.exist');

    // # Click the link
    cy.get('@savedLink').click();

    // * Check that the saved posts list is open in RHS
    cy.get('#searchContainer').should('be.visible').within(() => {
        cy.get('.sidebar--right__title').
            should('be.visible').
            and('have.text', 'Saved Posts');

        // * Check that the post pre-header is not shown for the saved message in RHS
        cy.get('#search-items-container').within(() => {
            cy.get(`#rhsPostMessageText_${postId}`).contains(message);
            cy.get('div.post-pre-header').should('not.exist');
        });
    });

    // # Close the RHS
    cy.get('#searchResultsCloseButton').should('be.visible').click();
}

export function verifyUnsavedPost(postId) {
    // * Check that the center save icon has been updated correctly
    cy.get(`#post_${postId}`).trigger('mouseover', {force: true});
    cy.get(`#CENTER_flagIcon_${postId}`).
        should('have.class', 'post-menu__item').
        and('have.attr', 'aria-label', 'save');

    // # Open the post-dotmenu
    cy.clickPostDotMenu(postId, 'CENTER');

    // * Check that the dotmenu item is changed accordingly
    cy.findAllByTestId(`post-menu-${postId}`).eq(0).should('be.visible');
    cy.findByText('Save').scrollIntoView().should('be.visible');
    cy.get(`#CENTER_dropdown_${postId}`).should('be.visible').type('{esc}');

    // * Check that the post is highlighted
    cy.get(`#post_${postId}`).should('not.have.class', 'post--pinned-or-flagged');

    // * Check that the post pre-header is visible
    cy.get('div.post-pre-header').should('not.exist');

    // * Check that the post pre-header has the saved icon
    cy.get('span.icon--post-pre-header').
        should('not.exist');

    // * Check that the post pre-header has the saved post link
    cy.get('div.post-pre-header__text-container').
        should('not.exist');

    // * Check that the saved posts list is not open in RHS before clicking the link in the post pre-header
    cy.get('#searchContainer').should('not.exist');

    // # Click the link
    cy.uiGetSavedPostButton().click();

    // * Check that the saved posts list is open in RHS
    cy.get('#searchContainer').should('be.visible').within(() => {
        cy.get('.sidebar--right__title').
            should('be.visible').
            and('have.text', 'Saved Posts');

        // * Check that the post pre-header is not shown for the saved message in RHS
        cy.get('#search-items-container').within(() => {
            cy.get(`#rhsPostMessageText_${postId}`).should('not.exist');
        });
    });

    // # Close the RHS
    cy.get('#searchResultsCloseButton').should('be.visible').click();
}

declare global {
    // eslint-disable-next-line @typescript-eslint/no-namespace
    namespace Cypress {
        interface Chainable {

            /**
             * Get post profile image of a given post ID or the last post if post ID is not given
             *
             * @param {string} - postId (optional)
             *
             * @example
             *   cy.uiGetPostProfileImage();
             */
            uiGetPostProfileImage: typeof uiGetPostProfileImage;

            /**
             * Get post header of a given post ID or the last post if post ID is not given
             *
             * @param {string} - postId (optional)
             *
             * @example
             *   cy.uiGetPostHeader();
             */
            uiGetPostHeader: typeof uiGetPostHeader;

            /**
             * Get post body of a given post ID or the last post if post ID is not given
             *
             * @param {string} - postId (optional)
             *
             * @example
             *   cy.uiGetPostBody();
             */
            uiGetPostBody: typeof uiGetPostBody;

            /**
             * Get post thread footer of a given post ID or the last post if post ID is not given
             *
             * @param {string} - postId (optional)
             *
             * @example
             *   cy.uiGetPostThreadFooter();
             */
            uiGetPostThreadFooter: typeof uiGetPostThreadFooter;

            /**
             * Get post embed container of a given post ID or the last post if post ID is not given
             *
             * @param {string} - postId (optional)
             *
             * @example
             *   cy.uiGetPostEmbedContainer();
             */
            uiGetPostEmbedContainer: typeof uiGetPostEmbedContainer;

            /**
             * Get post textbox
             *
             * @param {bool} option.exist - Set to false to check whether element should not exist. Otherwise, true (default) to check visibility.
             *
             * @example
             *   cy.uiGetPostTextBox();
             */
            uiGetPostTextBox: typeof uiGetPostTextBox;

            /**
             * Get reply textbox
             *
             * @param {bool} option.exist - Set to false to check whether element should not exist. Otherwise, true (default) to check visibility.
             *
             * @example
             *   cy.uiGetReplyTextBox();
             */
            uiGetReplyTextBox: typeof uiGetReplyTextBox;

            getPost: typeof getPost;
        }
    }
}
