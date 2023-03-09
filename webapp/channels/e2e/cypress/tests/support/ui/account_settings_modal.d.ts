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
// Custom command should follow naming convention of having `ui` prefix, e.g. `uiOpenProfileModal`.
// ***************************************************************

declare namespace Cypress {
    interface Chainable {

        /**
         * Open the account settings modal
         * @param {string} section - such as `'General'`, `'Security'`, `'Notifications'`, `'Display'`, `'Sidebar'` and `'Advanced'`
         * @return the "#accountSettingsModal"
         *
         * @example
         *   cy.uiOpenProfileModal().within(() => {
         *       // Do something here
         *   });
         */
        uiOpenProfileModal(section?: string): Chainable<JQuery<HTMLElement>>;

        /**
         * Close the account settings modal given that the modal itself is opened.
         *
         * @example
         *   cy.uiCloseAccountSettingsModal();
         */
        uiCloseAccountSettingsModal(): Chainable;

        /**
         * Navigate to account settings and verify the user's first, last name
         * @param {String} firstname - expected user firstname
         * @param {String} lastname - expected user lastname
         */
        verifyAccountNameSettings(firstname: string, lastname: string): Chainable;

        /**
         * Navigate to account display settings and change collapsed reply threads setting
         * @param {String} setting -  ON or OFF
         */
        uiChangeCRTDisplaySetting(setting: string): Chainable;

        /**
         * Navigate to account display settings and change message display setting
         * @param {String} setting -  COMPACT or STANDARD
         */
        uiChangeMessageDisplaySetting(setting: string): Chainable;
    }
}
