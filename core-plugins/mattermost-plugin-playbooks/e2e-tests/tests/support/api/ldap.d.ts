// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/// <reference types="cypress" />

// ***************************************************************
// Each command should be properly documented using JSDoc.
// See https://jsdoc.app/index.html for reference.
// Basic requirements for documentation are the following:
// - Meaningful description
// - Specific link to https://api.mattermost.com
// - Each parameter with `@params`
// - Return value with `@returns`
// - Example usage with `@example`
// Custom command should follow naming convention of having `api` prefix, e.g. `apiLDAPSync`.
// ***************************************************************

declare namespace Cypress {
    interface Chainable {

        /**
         * Synchronize any user attribute changes in the configured AD/LDAP server with Mattermost.
         * See https://api.mattermost.com/#operation/SyncLdap
         *
         * @example
         *   cy.apiLDAPSync();
         */
        apiLDAPSync(): Chainable;

        /**
         * Test the current AD/LDAP configuration to see if the AD/LDAP server can be contacted successfully.
         * See https://api.mattermost.com/#operation/TestLdap
         *
         * @example
         *   cy.apiLDAPTest();
         */
        apiLDAPTest(): Chainable;

        /**
         * Sync LDAP user
         * @returns {UserProfile} user - user object
         *
         * @example
         *   cy.apiSyncLDAPUser();
         */
        apiSyncLDAPUser(): Chainable<UserProfile>;
    }
}
