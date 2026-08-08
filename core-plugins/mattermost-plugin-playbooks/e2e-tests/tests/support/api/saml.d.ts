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
// Custom command should follow naming convention of having `api` prefix, e.g. `apiLogin`.
// ***************************************************************

declare namespace Cypress {
    interface Chainable {

        /**
         * Get the status of the uploaded certificates and keys in use by your SAML configuration.
         * See https://api.mattermost.com/#tag/SAML/paths/~1saml~1certificate~1status/get
         * @returns {Response} response: Cypress-chainable response which should have successful HTTP status of 200 OK to continue or pass.
         *
         * @example
         *   cy.apiGetSAMLCertificateStatus();
         */
        apiGetSAMLCertificateStatus(): Chainable<Response>;

        /**
         * Get SAML metadata from the Identity Provider. SAML must be configured properly.
         * See https://api.mattermost.com/#tag/SAML/paths/~1saml~1metadatafromidp/post
         * @param {String} samlMetadataUrl - SAML metadata URL
         * @returns {Response} response: Cypress-chainable response which should have successful HTTP status of 200 OK to continue or pass.
         *
         * @example
         *   cy.apiGetMetadataFromIdp(samlMetadataUrl);
         */
        apiGetMetadataFromIdp(samlMetadataUrl: string): Chainable<Response>;

        /**
         * Upload the IDP certificate to be used with your SAML configuration. The server will pick a hard-coded filename for the IdpCertificateFile setting in your config.json.
         * See https://api.mattermost.com/#tag/SAML/paths/~1saml~1certificate~1idp/post
         * @param {String} filePath - path of the IDP certificate file relative to fixture folder
         * @returns {Response} response: Cypress-chainable response which should have successful HTTP status of 200 OK to continue or pass.
         *
         * @example
         *   const filePath = 'saml-idp.crt';
         *   cy.apiUploadSAMLIDPCert(filePath);
         */
        apiUploadSAMLIDPCert(filePath: string): Chainable<Response>;

        /**
         * Upload the public certificate to be used for encryption with your SAML configuration. The server will pick a hard-coded filename for the PublicCertificateFile setting in your config.json.
         * See https://api.mattermost.com/#tag/SAML/paths/~1saml~1certificate~1public/post
         * @param {String} filePath - path of the public certificate file relative to fixture folder
         * @returns {Response} response: Cypress-chainable response which should have successful HTTP status of 200 OK to continue or pass.
         *
         * @example
         *   const filePath = 'saml-public.crt';
         *   cy.apiUploadSAMLPublicCert(filePath);
         */
        apiUploadSAMLPublicCert(filePath: string): Chainable<Response>;

        /**
         * Upload the private key to be used for encryption with your SAML configuration. The server will pick a hard-coded filename for the PrivateKeyFile setting in your config.json.
         * See https://api.mattermost.com/#tag/SAML/paths/~1saml~1certificate~1private/post
         * @param {String} filePath - path of the private certificate file relative to fixture folder
         * @returns {Response} response: Cypress-chainable response which should have successful HTTP status of 200 OK to continue or pass.
         *
         * @example
         *   const filePath = 'saml-private.crt';
         *   cy.apiUploadSAMLPublicCert(filePath);
         */
        apiUploadSAMLPrivateKey(filePath: string): Chainable<Response>;
    }
}
