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
// Custom command should follow naming convention of having `ui` prefix, e.g. `uiOpenSystemConsoleMainMenu`.
// ***************************************************************

declare namespace Cypress {
    interface Chainable {

        /**
         * Open main menu at system console
         * @param {string} item - such as `'Switch to [Team Name]'`, `'Administrator's Guide'`, `'Troubleshooting Forum'`, `'Commercial Support'`, `'About Mattermost'` and `'Log Out'`.
         * @return the main menu
         *
         * @example
         *   cy.uiOpenSystemConsoleMainMenu();
         */
        uiOpenSystemConsoleMainMenu(): Chainable;

        /**
         * Close main menu at system console
         *
         * @example
         *   cy.uiCloseSystemConsoleMainMenu();
         */
        uiCloseSystemConsoleMainMenu(): Chainable;

        /**
         * Get main menu at system console
         *
         * @example
         *   cy.uiGetSystemConsoleMainMenu();
         */
        uiGetSystemConsoleMainMenu(): Chainable;
    }
}
