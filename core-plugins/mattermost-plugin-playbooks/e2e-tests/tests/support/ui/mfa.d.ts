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
// Custom command should follow naming convention of having `ui` prefix, e.g. `uiGetMFASecret`.
// ***************************************************************

declare namespace Cypress {
    interface Chainable {

        /**
         * Get MFA secret of a given user
         * @param {string} userId - ID of user
         *
         * @returns {string} `secret` - MFA secret
         *
         * @example
         *   const headerLabel = 'What\'s New';
         *   cy.uiGetMFASecret('user-id').then((secret) => {
         *       // do something with the secret
         *   });
         */
        uiGetMFASecret(userId: string): Chainable<string>;
    }
}
