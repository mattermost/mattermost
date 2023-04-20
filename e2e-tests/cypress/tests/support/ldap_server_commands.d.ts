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
// Custom command should follow naming convention of having `external` prefix, e.g. `externalActivateUser`.
// ***************************************************************

declare namespace Cypress {
    interface Chainable {

        /**
        * addLDAPUsers is a cy.exec() wrapped as command to run ldap modify
        * against a local docker installation of OpenLdap.
        * @returns {string} - access token
        */
        addLDAPUsers(): Chainable;
    }
}
