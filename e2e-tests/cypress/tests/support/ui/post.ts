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

// ***********************************************************
// WYSIWYG composer helpers
//
// The composer can render either as a `<textarea>` (legacy) or a
// ProseMirror-based `contenteditable` element (WYSIWYG editor). The helpers
// below hide that difference so spec files do not need to branch on it.
// ***********************************************************

function isComposerWysiwyg(el: JQuery): boolean {
    return el[0]?.getAttribute('contenteditable') === 'true';
}

function uiGetComposerText(el: JQuery): string {
    if (isComposerWysiwyg(el)) {
        return (el[0].textContent || '');
    }

    const value = (el[0] as HTMLTextAreaElement).value;
    return typeof value === 'string' ? value : '';
}

function uiComposerIsEmpty(el: JQuery): boolean {
    const text = uiGetComposerText(el).trim();
    return text === '' || text === '\n';
}

// Submit the composer with the {enter} key, dismissing any open autocomplete
// (slash command, mention, channel, emoji) first. This mirrors how a real user
// would press {esc} to close a popover before sending. It is a no-op for
// messages that cannot trigger autocomplete.
function uiSendWithAutocomplete(subject: JQuery, message?: string): ChainableT<JQuery> {
    const head = (message || uiGetComposerText(subject)).slice(0, 1);
    const mightTriggerAutocomplete = /^[/~@:]/.test(head);
    const submitKeys = mightTriggerAutocomplete ? '{esc}{enter}' : '{enter}';
    return cy.wrap(subject).type(submitKeys);
}
Cypress.Commands.add('uiSendWithAutocomplete', {prevSubject: true}, uiSendWithAutocomplete);

// Assert that a composer-style element (`#post_textbox`, `#reply_textbox`,
// `#edit_textbox`) is focused. In WYSIWYG mode, focus lands on a child of the
// element rather than the element itself, so we click into it (which a real
// user does anyway when interacting with the editor) before checking that the
// active element matches the expected id.
function uiExpectComposerFocused(subject: JQuery): ChainableT<JQuery> {
    if (!isComposerWysiwyg(subject)) {
        return cy.wrap(subject).should('be.focused');
    }

    const expectedId = subject[0].id;
    return cy.wrap(subject).
        should('be.visible').
        click().
        then(() => cy.focused().should('have.attr', 'id', expectedId)).
        then(() => cy.wrap(subject));
}
Cypress.Commands.add('uiExpectComposerFocused', {prevSubject: true}, uiExpectComposerFocused);

function uiExpectComposerEmpty(subject: JQuery): ChainableT<JQuery> {
    return cy.wrap(subject).should((el: JQuery) => {
        expect(uiComposerIsEmpty(el), 'composer to be empty').to.be.true;
    });
}
Cypress.Commands.add('uiExpectComposerEmpty', {prevSubject: true}, uiExpectComposerEmpty);

function uiExpectComposerText(subject: JQuery, expected: string): ChainableT<JQuery> {
    if (!isComposerWysiwyg(subject)) {
        return cy.wrap(subject).should('have.value', expected);
    }

    return cy.wrap(subject).should((el: JQuery) => {
        expect(uiGetComposerText(el)).to.equal(expected);
    });
}
Cypress.Commands.add('uiExpectComposerText', {prevSubject: true}, uiExpectComposerText);

// Set composer content directly (bypassing keystroke-by-keystroke typing).
// Useful for very long strings where typing is too slow. For WYSIWYG, this
// dispatches a synthetic paste so ProseMirror picks up the value through its
// own event pipeline.
function uiSetComposerValue(subject: JQuery, text: string): ChainableT<JQuery> {
    const el = subject[0];
    if (isComposerWysiwyg(subject)) {
        el.focus();
        const dt = new DataTransfer();
        dt.setData('text/plain', text);
        el.dispatchEvent(new ClipboardEvent('paste', {clipboardData: dt, bubbles: true, cancelable: true}));
    } else {
        (el as HTMLTextAreaElement).value = text;
        el.dispatchEvent(new Event('input', {bubbles: true}));
    }
    return cy.wrap(subject);
}
Cypress.Commands.add('uiSetComposerValue', {prevSubject: true}, uiSetComposerValue);

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

function editLastPostWithNewMessage(message: string) {
    cy.uiGetPostTextBox().type('{uparrow}');

    // * Edit Post Input should appear
    cy.get('#edit_textbox').should('be.visible');

    // # Update the post message and click Save
    cy.get('#edit_textbox').clear().type(message)
    cy.get('#create_post').findByText('Save').scrollIntoView().click();
}
Cypress.Commands.add('editLastPostWithNewMessage', editLastPostWithNewMessage);

export function verifySavedPost(postId: string, message: string) {
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
    cy.get('body').type('{esc}');

    cy.get('#postListContent').within(() => {
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
    });

    // * Check that the saved posts list is not open in RHS before clicking the link in the post pre-header
    cy.get('#searchContainer').should('not.exist');

    // # Click the link
    cy.get('@savedLink').click();

    // * Check that the saved posts list is open in RHS
    cy.get('#searchContainer').should('be.visible').within(() => {
        cy.get('.sidebar--right__title').
            should('be.visible').
            and('have.text', 'Saved messages');

        // * Check that the post pre-header is not shown for the saved message in RHS
        cy.get(`#searchResult_${postId}`).within(() => {
            cy.get(`#rhsPostMessageText_${postId}`).contains(message);
            cy.get('div.post-pre-header').should('not.exist');
        });
    });

    // # Close the RHS
    cy.get('#searchResultsCloseButton').should('be.visible').click();
}

export function verifyUnsavedPost(postId: string) {
    // * Check that the center save icon has been updated correctly
    cy.get(`#post_${postId}`).trigger('mouseover', {force: true});
    cy.get(`#CENTER_flagIcon_${postId}`).
        should('have.class', 'post-menu__item').
        and('have.attr', 'aria-label', 'save message');

    // # Open the post-dotmenu
    cy.clickPostDotMenu(postId, 'CENTER');

    // * Check that the dotmenu item is changed accordingly
    cy.findAllByTestId(`post-menu-${postId}`).eq(0).should('be.visible');
    cy.findByText('Save Message').scrollIntoView().should('be.visible');
    cy.get('body').type('{esc}');

    cy.get('#postListContent').within(() => {
        // * Check that the post is not highlighted
        cy.get(`#post_${postId}`).should('not.have.class', 'post--pinned-or-flagged');

        // * Check that the post pre-header is not visible
        cy.get('div.post-pre-header').should('not.exist');

        // * Check that the post pre-header does not have the saved icon
        cy.get('span.icon--post-pre-header').
            should('not.exist');

        // * Check that the post pre-header does not have the saved post link
        cy.get('div.post-pre-header__text-container').
            should('not.exist');
    });

    // * Check that the saved posts list is not open in RHS before clicking the link in the post pre-header
    cy.get('#searchContainer').should('not.exist');

    // # Click the link
    cy.uiGetSavedPostButton().click();

    // * Check that the saved posts list is open in RHS
    cy.get('#searchContainer').should('be.visible').within(() => {
        cy.get('.sidebar--right__title').
            should('be.visible').
            and('have.text', 'Saved messages');

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
             * Edit last post with a new message
             *
             * @param {string} - message
             *
             * @example
             *   cy.editLastPostWithNewMessage('new message');
             */
            editLastPostWithNewMessage: typeof editLastPostWithNewMessage;

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

            /**
             * Submit a composer with {enter}, dismissing any open autocomplete first.
             * Used for messages that may have triggered slash, mention, channel or
             * emoji autocomplete and need {esc} before {enter} to actually post.
             *
             * @example
             *   cy.uiGetPostTextBox().type('/echo hello').uiSendWithAutocomplete();
             */
            uiSendWithAutocomplete(message?: string): ChainableT<JQuery>;

            /**
             * Assert that a composer (`#post_textbox`, `#reply_textbox`,
             * `#edit_textbox`) is focused. Handles both legacy `<textarea>` and
             * WYSIWYG `contenteditable` editors.
             *
             * @example
             *   cy.uiGetReplyTextBox().uiExpectComposerFocused();
             */
            uiExpectComposerFocused(): ChainableT<JQuery>;

            /**
             * Assert that a composer is empty.
             *
             * @example
             *   cy.uiGetPostTextBox().uiExpectComposerEmpty();
             */
            uiExpectComposerEmpty(): ChainableT<JQuery>;

            /**
             * Assert that a composer has the exact given text content. Use
             * instead of `should('have.value', ...)` for WYSIWYG compatibility.
             *
             * @example
             *   cy.uiGetPostTextBox().uiExpectComposerText('Hello');
             */
            uiExpectComposerText(expected: string): ChainableT<JQuery>;

            /**
             * Set the composer's content directly (bypasses typing keystrokes).
             * Useful for very long strings. Dispatches a synthetic paste in
             * WYSIWYG so ProseMirror picks up the value.
             *
             * @example
             *   cy.uiGetPostTextBox().clear().uiSetComposerValue(longText);
             */
            uiSetComposerValue(text: string): ChainableT<JQuery>;

            getPost: typeof getPost;
        }
    }
}
