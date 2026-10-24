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
         * Delete all custom retention policies
         */
        apiDeleteAllCustomRetentionPolicies(): Chainable;

        /**
         * Create a post with create_at prop via API
         * @param {string} channelId - Channel ID
         * @param {string} message - Post a message
         * @param {string} token - token
         * @param {number} createat -  epoch date
         */
        apiPostWithCreateDate(channelId: string, message: string, token: string, createat: number): Chainable;
    }
}
