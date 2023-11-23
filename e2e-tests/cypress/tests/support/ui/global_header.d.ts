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
// Custom command should follow naming convention of having `ui` prefix, e.g. `uiGetProductMenuButton`.
// ***************************************************************

declare namespace Cypress {
    interface Chainable {

        /**
         * Get product switch button
         *
         * @example
         *   cy.uiGetProductMenuButton().click();
         */
        uiGetProductMenuButton(): Chainable;

        /**
         * Get product switch menu
         *
         * @example
         *   cy.uiGetProductMenu().click();
         */
        uiGetProductMenu(): Chainable;

        /**
         * Open product switch menu
         *
         * @param {string} item - menu item ex. System Console, Integrations, etc.
         *
         * @example
         *   cy.uiOpenProductMenu().click();
         */
        uiOpenProductMenu(item: string): Chainable;

        /**
         * Get set status button
         *
         * @example
         *   cy.uiGetSetStatusButton().click();
         */
        uiGetSetStatusButton(): Chainable;

        /**
         * Get profile header
         *
         * @example
         *   cy.uiGetProfileHeader();
         */
        uiGetProfileHeader(): Chainable;

        /**
         * Get status menu container
         *
         * @param {bool} option.exist - Set to false to not verify if the element exists. Otherwise, true (default) to check existence.
         * @example
         *   cy.uiGetStatusMenuContainer({exist: false});
         */
        uiGetStatusMenuContainer(option: Record<string, boolean>): Chainable;

        /**
         * Get user menu
         *
         * @example
         *   cy.uiGetStatusMenu();
         */
        uiGetStatusMenu(): Chainable;

        /**
         * Open help menu
         *
         * @param {string} item - menu item ex. Ask the community, Help resources, etc.
         *
         * @example
         *   cy.uiOpenHelpMenu();
         */
        uiOpenHelpMenu(item: string): Chainable;

        /**
         * Get help button
         *
         * @example
         *   cy.uiGetHelpButton();
         */
        uiGetHelpButton(): Chainable;

        /**
         * Get help menu
         *
         * @example
         *   cy.uiGetHelpMenu();
         */
        uiGetHelpMenu(): Chainable;

        /**
         * Open user menu
         *
         * @param {string} [item] - menu item ex. Profile, Logout, etc.
         *
         * @example
         *   cy.uiOpenUserMenu();
         */
        uiOpenUserMenu(item?: string): Chainable;

        /**
         * Get search form container
         *
         * @example
         *   cy.uiGetSearchContainer();
         */
        uiGetSearchContainer(): Chainable;

        /**
         * Get search box
         *
         * @example
         *   cy.uiGetSearchBox();
         */
        uiGetSearchBox(): Chainable;

        /**
         * Get at-mention button
         *
         * @example
         *   cy.uiGetRecentMentionButton();
         */
        uiGetRecentMentionButton(): Chainable;

        /**
         * Get saved posts button
         *
         * @example
         *   cy.uiGetSavedPostButton();
         */
        uiGetSavedPostButton(): Chainable;

        /**
         * Get settings button
         *
         * @example
         *   cy.uiGetSettingsButton();
         */
        uiGetSettingsButton(): Chainable;

        /**
         * Get settings modal
         *
         * @example
         *   cy.uiGetSettingsModal();
         */
        uiGetSettingsModal(): Chainable;

        /**
         * Get channel info button
         *
         * @example
         *  cy.uiGetChannelInfoButton();
         */
        uiGetChannelInfoButton(): Chainable;

        /**
         * Open settings modal
         *
         * @param {string} section - ex. Display, Sidebar, etc.
         *
         * @example
         *   cy.uiOpenSettingsModal();
         */
        uiOpenSettingsModal(section: string): Chainable;

        /**
         * User log out via user menu
         *
         * @example
         *   cy.uiLogout();
         */
        uiLogout(): Chainable;
    }
}
