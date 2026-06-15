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
         * Get the schemes.
         * See https://api.mattermost.com/#tag/schemes/paths/~1schemes/get
         * @param {string} scope - Limit the results returned to the provided scope, either team or channel.
         * @returns {Scheme[]} `out.schemes` as `Scheme[]`
         *
         * @example
         *   cy.apiGetSchemes('team').then(({schemes}) => {
         *       // do something with schemes
         *   });
         */
        apiGetSchemes(scope: string): Chainable<{schemes: Scheme[]}>;

        /**
         * Delete a scheme.
         * See https://api.mattermost.com/#tag/schemes/paths/~1schemes~1{scheme_id}/delete
         * @param {string} schemeId - ID of the scheme to delete
         * @returns {Response} response: Cypress-chainable response which should have successful HTTP status of 200 OK to continue or pass.
         *
         * @example
         *   cy.apiDeleteScheme('scheme_id');
         */
        apiDeleteScheme(schemeId: string): Chainable<Response>;
    }
}
