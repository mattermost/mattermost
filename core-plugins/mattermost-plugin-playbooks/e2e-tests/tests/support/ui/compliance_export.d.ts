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
// ***************************************************************

declare namespace Cypress {
    interface Chainable {

        /**
         * Select compliance export format
         * @param {string} exportFormat - compliance export format
         *
         * @example
         *   const EXPORTFORMAT = "Actiance XML";
         *   cy.uiEnableComplianceExport(Compliance Export Format);
         */
        uiEnableComplianceExport(exportFormat: string): Chainable;

        /**
         * Go to Compliance Page
         */
        uiGoToCompliancePage(): Chainable;

        /**
         * Click Run Export Compliance and wait for Success status
         */
        uiExportCompliance(): Chainable;
    }
}
