// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {AdminConfig} from '@mattermost/types/config';

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @enterprise @saml

/**
 * Note: This test requires Enterprise license to be uploaded
 */
const testSamlMetadataUrl = 'http://test_saml_metadata_url';
const testSamlMetadataSuccessUrl = 'http://test_saml_metadata_success_url';
const testIdpURL = 'http://test_idp_url';
const testIdpDescriptorURL = 'http://test_idp_descriptor_url';
const testFetchedIdpURL = 'http://test_fetched_idp_url';
const testFetchedIdpDescriptorURL = 'http://test_fetched_idp_descriptor_url';
const testIdpPublicCertificate = 'MIICozCCAYsCBgGNzWfMwjANBgkqhkiG9w0BAQsFADAVMRMwEQYDVQQDDAptYXR0ZXJtb3N0';
const getSamlMetadataErrorMessage = 'SAML Metadata URL did not connect and pull data successfully';
const getSamlMetadataSuccessMessage = 'SAML Metadata retrieved successfully. Two fields and one certificate have been updated';

let config: AdminConfig;

describe('SystemConsole->SAML 2.0 - Get Metadata from Idp Flow', () => {
    before(() => {
        // * Check if server has license for SAML
        cy.apiRequireLicenseForFeature('SAML');

        cy.apiUpdateConfig({
            SamlSettings: {
                Enable: true,
                AssertionConsumerServiceURL: Cypress.config('baseUrl') + '/login/sso/saml',
                ServiceProviderIdentifier: Cypress.config('baseUrl') + '/login/sso/saml',
                IdpMetadataURL: '',
                IdpURL: testIdpURL,
                IdpDescriptorURL: testIdpDescriptorURL,
            },
        }).then((data) => {
            ({config} = data);
        });

        //make sure we can navigate to SAML settings
        cy.visit('/admin_console/authentication/saml');
        cy.get('.admin-console__header').should('be.visible').and('have.text', 'SAML 2.0');
    });

    it('fail to fetch metadata from Idp Metadata Url', () => {
        // * Verify that the metadata Url textbox is enabled and empty
        cy.findByTestId('SamlSettings.IdpMetadataURLinput').
            scrollIntoView().should('be.visible').and('be.enabled').and('have.text', '');

        // * Verify that the Get Metadata Url fetch button is disabled
        cy.get('#getSamlMetadataFromIDPButton').find('button').should('be.visible').and('be.disabled');

        // # Type in the metadata Url in the metadata Url textbox
        cy.findByTestId('SamlSettings.IdpMetadataURLinput').
            scrollIntoView().should('be.visible').
            focus().type(testSamlMetadataUrl);

        // # Click on the Get SAML Metadata Button
        cy.get('#getSamlMetadataFromIDPButton button').click();

        // * Verify that we get the right error message
        cy.get('#getSamlMetadataFromIDPButton').should('be.visible').contains(getSamlMetadataErrorMessage);

        // * Verify that the IdpURL textbox content has not been updated
        cy.findByTestId('SamlSettings.IdpURLinput').then((elem) => {
            Cypress.$(elem).val() === config.SamlSettings.IdpURL;
        });

        // * Verify that the IdpDescriptorURL textbox content has not been updated
        cy.findByTestId('SamlSettings.IdpDescriptorURL').then((elem) => {
            Cypress.$(elem).val() === config.SamlSettings.IdpDescriptorURL;
        });

        // * Verify that the IdpDescriptorURL textbox content has been updated
        cy.findByTestId('SamlSettings.ServiceProviderIdentifier').then((elem) => {
            Cypress.$(elem).val() === config.SamlSettings.ServiceProviderIdentifier;
        });

        // * Verify that we can successfully save the settings (we have not affected previous state)
        cy.get('#saveSetting').click();
    });

    it('fetches metadata and sets the IdP certificate from Idp Metadata Url', () => {
        cy.apiUpdateConfig({
            SamlSettings: {
                Enable: true,
                IdpMetadataURL: testSamlMetadataSuccessUrl,
                IdpURL: testIdpURL,
                IdpDescriptorURL: testIdpDescriptorURL,
                AssertionConsumerServiceURL: Cypress.config('baseUrl') + '/login/sso/saml',
                ServiceProviderIdentifier: Cypress.config('baseUrl') + '/login/sso/saml',
            },
        });

        cy.visit('/admin_console/authentication/saml');

        cy.intercept('POST', '**/api/v4/saml/metadatafromidp', (req) => {
            req.reply({
                statusCode: 200,
                body: {
                    idp_url: testFetchedIdpURL,
                    idp_descriptor_url: testFetchedIdpDescriptorURL,
                    idp_public_certificate: testIdpPublicCertificate,
                },
            });
        }).as('getSamlMetadataFromIdp');

        cy.intercept('POST', '**/api/v4/saml/certificate/idp', (req) => {
            expect(req.headers['content-type']).to.eq('application/x-pem-file');
            expect(req.body).to.eq(testIdpPublicCertificate);

            req.reply({
                statusCode: 200,
                body: {status: 'OK'},
            });
        }).as('setSamlIdpCertificateFromMetadata');

        // # Click on the Get SAML Metadata Button
        cy.get('#getSamlMetadataFromIDPButton button').scrollIntoView().should('be.visible').and('be.enabled').click();

        // * Verify that the metadata and certificate endpoints are called
        cy.wait('@getSamlMetadataFromIdp');
        cy.wait('@setSamlIdpCertificateFromMetadata');

        // * Verify that the IdP URL fields have been updated
        cy.findByTestId('SamlSettings.IdpURLinput').should('have.value', testFetchedIdpURL);
        cy.findByTestId('SamlSettings.IdpDescriptorURLinput').should('have.value', testFetchedIdpDescriptorURL);

        // * Verify that the success message reflects the updated fields and certificate
        cy.get('#getSamlMetadataFromIDPButton').should('be.visible').contains(getSamlMetadataSuccessMessage);

        // * Verify that the IdP certificate row shows the remove certificate view
        cy.contains('.remove-filename', 'saml-idp.crt').should('be.visible');
        cy.contains('button', 'Remove Identity Provider Certificate').should('be.visible');
    });
});
