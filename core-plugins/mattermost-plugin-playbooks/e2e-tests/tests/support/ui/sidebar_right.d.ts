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
// Custom command should follow naming convention of having `ui` prefix, e.g. `uiGetRHS`.
// ***************************************************************

declare namespace Cypress {
    interface Chainable {

        /**
         * Get RHS container
         *
         *  @param {bool} option.visible - Set to false to check whether RHS is not visible. Otherwise, true (default) to check visibility.
         *
         * @example
         *   cy.uiGetRHS();
         */
        uiGetRHS(option?: Record<string, boolean>): Chainable;

        /**
         * Close RHS
         *
         * @example
         *   cy.uiCloseRHS();
         */
        uiCloseRHS(): Chainable;

        /**
         * Expand RHS
         *
         * @example
         *   cy.uiExpandRHS();
         */
        uiExpandRHS(): Chainable;

        /**
         * Verify if RHS is expanded
         *
         * @example
         *   cy.uiGetRHS().isExpanded();
         */
        isExpanded(): Chainable;

        /**
         * Get "Reply" button
         *
         * @example
         *   cy.uiGetReply();
         */
        uiGetReply(): Chainable;

        /**
         * Reply by clicking "Reply" button
         *
         * @example
         *   cy.uiReply();
         */
        uiReply(): Chainable;

        /**
         * Get RHS container
         *
         *  @param {bool} option.visible - Set to false to check whether Search container at RHS is not visible. Otherwise, true (default) to check visibility.
         *
         * @example
         *   cy.uiGetRHSSearchContainer();
         */
        uiGetRHSSearchContainer(option: Record<string, boolean>): Chainable;

        /**
         * Get file filter button from RHS.
         *
         * @example
         *   cy.uiGetFileFilterButton().click();
         */
        uiGetFileFilterButton(): Chainable;

        /**
         * Get file filter menu from RHS
         *
         * @param {bool} option.exist - Set to false to check whether file filter menu should not exist at RHS. Otherwise, true (default) to check visibility.
         *
         * @example
         *   cy.uiGetFileFilterMenu();
         */
        uiGetFileFilterMenu(): Chainable;

        /**
         * Open file filter menu from RHS
         * @param {string} item - such as `'Documents'`, `'Spreadsheets'`, `'Presentations'`, `'Code'`, `'Images'`, `'Audio'` and `'Videos'`.
         * @return the file filter menu
         *
         * @example
         *   cy.uiOpenFileFilterMenu();
         */
        uiOpenFileFilterMenu(): Chainable;
    }
}
