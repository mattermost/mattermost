// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// *****************************************************************************
// SAML
// https://api.mattermost.com/#tag/SAML
// *****************************************************************************

Cypress.Commands.add('apiGetSAMLCertificateStatus', () => {
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: '/api/v4/saml/certificate/status',
        method: 'GET',
    }).then((response) => {
        expect(response.status).to.be.oneOf([200, 201]);
        return cy.wrap(response);
    });
});

Cypress.Commands.add('apiGetMetadataFromIdp', (samlMetadataUrl) => {
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: '/api/v4/saml/metadatafromidp',
        method: 'POST',
        body: {saml_metadata_url: samlMetadataUrl},
    }).then((response) => {
        expect(response.status, 'Failed to obtain metadata from Identity Provider URL').to.equal(200);
        return cy.wrap(response);
    });
});

Cypress.Commands.add('apiUploadSAMLIDPCert', (filePath) => {
    cy.apiUploadFile('certificate', filePath, {url: '/api/v4/saml/certificate/idp', method: 'POST', successStatus: 200});
});

Cypress.Commands.add('apiUploadSAMLPublicCert', (filePath) => {
    cy.apiUploadFile('certificate', filePath, {url: '/api/v4/saml/certificate/public', method: 'POST', successStatus: 200});
});

Cypress.Commands.add('apiUploadSAMLPrivateKey', (filePath) => {
    cy.apiUploadFile('certificate', filePath, {url: '/api/v4/saml/certificate/private', method: 'POST', successStatus: 200});
});
