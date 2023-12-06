// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as TIMEOUTS from '../../fixtures/timeouts';

const path = require('path');

// *****************************************************************************
// Common / Helper commands
// *****************************************************************************

Cypress.Commands.add('apiUploadFile', (name, filePath, options = {}) => {
    const formData = new FormData();
    const filename = path.basename(filePath);

    cy.fixture(filePath, 'binary', {timeout: TIMEOUTS.TWENTY_MIN}).
        then(Cypress.Blob.binaryStringToBlob).
        then((blob) => {
            formData.set(name, blob, filename);
            formRequest(options.method, options.url, formData, options.successStatus);
        });
});

Cypress.Commands.add('apiDownloadFileAndVerifyContentType', (fileURL, contentType = 'application/zip') => {
    cy.request(fileURL).then((response) => {
        // * Verify the download
        expect(response.status).to.equal(200);

        // * Confirm its content type
        expect(response.headers['content-type']).to.equal(contentType);
    });
});

/**
 * Process binary file HTTP form request.
 * @param {String} method - HTTP request method
 * @param {String} url - HTTP resource URL
 * @param {FormData} formData - Key value pairs representing form fields and value
 * @param {Number} successStatus - HTTP status code
 */
function formRequest(method, url, formData, successStatus) {
    const baseUrl = Cypress.config('baseUrl');
    const xhr = new XMLHttpRequest();
    xhr.open(method, url, false);
    let cookies = '';
    cy.getCookie('MMCSRF', {log: false}).then((token) => {
        //get MMCSRF cookie value
        const csrfToken = token.value;
        cy.getCookies({log: false}).then((cookieValues) => {
            //prepare cookie string
            cookieValues.forEach((cookie) => {
                cookies += cookie.name + '=' + cookie.value + '; ';
            });

            //set headers
            xhr.setRequestHeader('Access-Control-Allow-Origin', baseUrl);
            xhr.setRequestHeader('Access-Control-Allow-Methods', 'GET, POST, PUT');
            xhr.setRequestHeader('X-CSRF-Token', csrfToken);
            xhr.setRequestHeader('Cookie', cookies);
            xhr.send(formData);
            if (xhr.readyState === 4) {
                expect(xhr.status, 'Expected form request to be processed successfully').to.equal(successStatus);
            } else {
                expect(xhr.status, 'Form request process delayed').to.equal(successStatus);
            }
        });
    });
}
