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
// Custom command should follow naming convention of having `ui` prefix, e.g. `uiCheckLicenseExists`.
// ***************************************************************

declare namespace Cypress {
    interface Chainable {

        /**
         * Verify license exists via admin console.
         *
         * @example
         *   cy.uiCheckLicenseExists();
         */
        uiCheckLicenseExists(): Chainable;

        /**
         * Reset system scheme permissions via System Console
         *
         * @example
         *   cy.uiResetPermissionsToDefault();
         */
        uiResetPermissionsToDefault(): Chainable;

        /**
         * Save settings located in System Console
         *
         * @example
         *   cy.uiSaveConfig();
         */
        uiSaveConfig(): Chainable;
    }
}
