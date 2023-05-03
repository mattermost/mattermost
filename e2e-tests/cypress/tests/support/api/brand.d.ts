// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/// <reference types="cypress" />

// ***************************************************************
// Each command should be properly documented using JSDoc.
// See https://jsdoc.app/index.html for reference.
// Basic requirements for documentation are the following:
// - Meaningful description
// - Specific link to https://api.mattermost.com
// - Each parameter with `@params`
// - Return value with `@returns`
// - Example usage with `@example`
// Custom command should follow naming convention of having `api` prefix, e.g. `apiLogin`.
// ***************************************************************

declare namespace Cypress {
    interface Chainable {

        /**
         * Delete the custom brand image.
         * See https://api.mattermost.com/#tag/brand/paths/~1brand~1image/delete
         * @returns {Response} response: Cypress-chainable response which should have either a successful HTTP status of 200 OK
         * or a 404 Not Found in case that the image didn't exists to continue or pass.
         *
         * @example
         *   cy.apiDeleteBrandImage();
         */
        apiDeleteBrandImage(): Chainable<Record<string, any>>;
    }
}
