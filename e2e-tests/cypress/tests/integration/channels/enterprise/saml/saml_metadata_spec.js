// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

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
const testIdpURL = 'http://test_idp_url';
const testIdpDescriptorURL = 'http://test_idp_descriptor_url';
const getSamlMetadataErrorMessage = 'SAML Metadata URL did not connect and pull data successfully';

let config;

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
});
