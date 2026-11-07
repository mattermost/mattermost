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
// Custom command should follow naming convention of having `ui` prefix, e.g. `uiSave`.
// ***************************************************************

declare namespace Cypress {
    interface Chainable {

        /**
         * Click 'Save' button
         *
         * @example
         *   cy.uiSave();
         */
        uiSave(): Chainable;

        /**
         * Click 'Cancel' button
         *
         * @example
         *   cy.uiCancel();
         */
        uiCancel(): Chainable;

        /**
         * Click 'Close' button
         *
         * @example
         *   cy.uiClose();
         */
        uiClose(): Chainable;

        /**
         * Click Save then Close buttons
         *
         * @example
         *   cy.uiSaveAndClose();
         */
        uiSaveAndClose(): Chainable;

        /**
         * Get a button by its text using "cy.findByRole"
         *
         * @param {String} label - Button text
         *
         * @example
         *   cy.uiGetButton('Save');
         */
        uiGetButton(label: string): Chainable;

        /**
         * Get save button
         *
         * @example
         *   cy.uiSaveButton();
         */
        uiSaveButton(): Chainable;

        /**
         * Get cancel button
         *
         * @example
         *   cy.uiCancelButton();
         */
        uiCancelButton(): Chainable;

        /**
         * Get close button
         *
         * @example
         *   cy.uiCloseButton();
         */
        uiCloseButton(): Chainable;

        /**
         * Get a radio button by its text using "cy.findByRole"
         *
         * @example
         *   cy.uiGetRadioButton('Custom Theme');
         */
        uiGetRadioButton(): Chainable;

        /**
         * Get a heading by its text using "cy.findByRole"
         *
         * @param {string} headingText - Heading text
         *
         * @example
         *   cy.uiGetHeading('General Settings');
         */
        uiGetHeading(headingText: string): Chainable;

        /**
         * Get a textbox by its text using "cy.findByRole"
         *
         * @param {string} text - Textbox label
         *
         * @example
         *   cy.uiGetTextbox('Nickname');
         */
        uiGetTextbox(text: string): Chainable;
    }
}
