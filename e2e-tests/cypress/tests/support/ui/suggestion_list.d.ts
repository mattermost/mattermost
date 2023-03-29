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
         * Verify user's at-mention in the suggestion list
         * @param {UserProfile} user - user object
         * @param {boolean} isSelected - check if user is selected with false as default
         * @param {string} sectionDividerName - name of the section in suggestion list, ex. "Channel Members"
         *
         * @example
         *   cy.uiVerifyAtMentionInSuggestionList(user, true, 'Channel Members');
         */
        uiVerifyAtMentionInSuggestionList(user: UserProfile, isSelected: boolean, sectionDividerName?: string): Chainable;

        /**
         * Verify user's at-mention suggestion
         * @param {UserProfile} user - user object
         * @param {boolean} isSelected - check if user is selected with false as default
         *
         * @example
         *   cy.uiVerifyAtMentionSuggestion(user, true);
         */
        uiVerifyAtMentionSuggestion(user: UserProfile, isSelected?: boolean): Chainable;
    }
}
