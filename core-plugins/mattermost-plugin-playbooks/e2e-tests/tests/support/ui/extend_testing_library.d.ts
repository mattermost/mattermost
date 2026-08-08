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
// Custom command should follow naming convention of the Testing Library commands
// ***************************************************************

declare namespace Cypress {
    interface Chainable {

        /**
         * Extends `findByRole` by matching case to `name` as insensitive but sensitive to `text` value
         * @param {string} role - button, input, textbox, etc.
         * @param {Object} option - text value of the target element
         *
         * @example
         *   cy.findByRoleExtended('button', {name: 'Advanced'}).should('be.visible').click();
         */
        findByRoleExtended(role: string, option: {name: string}): Chainable;
    }
}
