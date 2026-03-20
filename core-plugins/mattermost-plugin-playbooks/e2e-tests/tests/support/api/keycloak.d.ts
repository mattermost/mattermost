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
// Custom command should follow naming convention of having `api` prefix, e.g. `apiKeycloakGetAccessToken`.
// ***************************************************************

declare namespace Cypress {
    interface Chainable {

        /**
         * Get access token from Keycloak
         * See https://www.keycloak.org/documentation
         * @returns {string} token
         *
         * @example
         *   cy.apiKeycloakGetAccessToken();
         */
        apiKeycloakGetAccessToken(): Chainable<string>;

        /**
         * Save realm to Keycloak
         * See https://www.keycloak.org/documentation
         * @param {string} options.accessToken - valid token to authorize a request
         * @param {Boolean} options.failOnStatusCode - whether to fail on status code, default is true
         * @returns {Response} response: Cypress-chainable response
         *
         * @example
         *   cy.apiKeycloakSaveRealm('access-token');
         */
        apiKeycloakSaveRealm(accessToken: string, failOnStatusCode: boolean): Chainable<Response>;

        /**
         * Get realm from Keycloak
         * See https://www.keycloak.org/documentation
         * @param {string} options.accessToken - valid token to authorize a request
         * @param {Boolean} options.failOnStatusCode - whether to fail on status code, default is true
         * @returns {Response} response: Cypress-chainable response
         *
         * @example
         *   cy.apiKeycloakGetRealm('access-token');
         */
        apiKeycloakGetRealm(accessToken: string, failOnStatusCode: boolean): Chainable<Response>;

        /**
         * Verify Keycloak is reachable and has realm setup
         * See https://www.keycloak.org/documentation
         * @returns {Response} response: Cypress-chainable response
         *
         * @example
         *   cy.apiRequireKeycloak();
         */
        apiRequireKeycloak(): Chainable<string>;
    }
}
