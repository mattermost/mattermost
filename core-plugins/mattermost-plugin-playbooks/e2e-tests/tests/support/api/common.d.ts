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
         * Upload file directly via API.
         * @param {String} name - name of form
         * @param {String} filePath - path of the file to upload; can be relative or absolute
         * @param {Object} options - request options
         * @param {String} options.url - HTTP resource URL
         * @param {String} options.method - HTTP request method
         * @param {Number} options.successStatus - HTTP status code
         *
         * @example
         *   cy.apiUploadFile('certificate', filePath, {url: '/api/v4/saml/certificate/public', method: 'POST', successStatus: 200});
         */
        apiUploadFile(name: string, filePath: string, options: Record<string, unknown>): Chainable<Response>;

        /**
         * Verify export file content-type
         * @param {String} fileURL - Export file URL
         * @param {String} contentType - File content-Type
         */
        apiDownloadFileAndVerifyContentType(fileURL: string, contentType: string): Chainable;
    }
}
