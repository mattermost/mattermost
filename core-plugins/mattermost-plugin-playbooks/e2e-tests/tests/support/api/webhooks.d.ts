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
// Custom command should follow naming convention of having `api` prefix, e.g. `apiLogin`.
// ***************************************************************

declare namespace Cypress {
    interface Chainable {

        /**
         * Get an incoming webhook given the hook id.
         * @param {string} hookId - Incoming Webhook GUID
         * @returns {IncomingWebhook} `out.webhook` as `IncomingWebhook`
         * @returns {string} `out.status`
         * @example
         *   cy.apiGetIncomingWebhook('hook-id')
         */
        apiGetIncomingWebhook(hookId: string): Chainable<Record<string, any>>;

        /**
         * Get an outgoing webhook given the hook id.
         * @param {string} hookId - Outgoing Webhook GUID
         * @returns {OutgoingWebhook} `out.webhook` as `OutgoingWebhook`
         * @returns {string} `out.status`
         * @example
         *   cy.apiGetOutgoingWebhook('hook-id')
         */
        apiGetOutgoingWebhook(hookId: string): Chainable<Record<string, any>>;
    }
}
