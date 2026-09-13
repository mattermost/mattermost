// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/// <reference types="cypress" />

// ***************************************************************
// Each command should be properly documented using JSDoc.
// See https://jsdoc.app/index.html for reference.
// Basic requirements for documentation are the following:
// - Meaningful description
// - Each parameter with `@params`
// - Return value with `@returns`
// - Example usage with `@example`
// Custom command should follow naming convention of having `ui` prefix, e.g. `uiClickCopyLink`.
// ***************************************************************

declare namespace Cypress {
    interface Chainable {

        /**
         * Click on "Copy Link" of post dropdown menu and verifies if the link is copied into the clipboard
         * Created user has an option to log in after all are setup.
         * @param {string} permalink - permalink to verify if copied into the clipboard
         *
         * @example
         *   const permalink = 'http://localhost:8065/team-name/pl/post-id';
         *   cy.uiClickCopyLink(permalink);
         */
        uiClickCopyLink(permalink: string, postId: string): Chainable;

        /**
         * Click dropdown menu of a post by post ID.
         * @param {String} postId - post ID
         * @param {String} menuItem - e.g. "Pin to channel"
         * @param {String} location - 'CENTER' (default), 'SEARCH', RHS_ROOT, RHS_COMMENT
         */
        uiClickPostDropdownMenu(postId: string, menuItem: string, location?: string): Chainable;
    }
}
