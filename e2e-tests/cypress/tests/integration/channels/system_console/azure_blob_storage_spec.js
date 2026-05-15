// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @not_cloud @system_console

describe('Environment - File Storage (Azure Blob Storage)', () => {
    before(() => {
        cy.shouldNotRunOnCloudEdition();
        cy.apiAdminLogin();
    });

    beforeEach(() => {
        cy.visit('/admin_console/environment/file_storage');
        cy.findByTestId('FileSettings.DriverNamedropdown').should('be.visible');
    });

    it('shows the Azure Blob Storage option in the File Storage System dropdown', () => {
        // * Verify the Azure option is present alongside Local and S3
        cy.findByTestId('FileSettings.DriverNamedropdown').
            find('option[value="azureblob"]').
            should('have.text', 'Azure Blob Storage');
    });

    it('enables Azure-only fields and disables S3-only fields when Azure is selected', () => {
        // # Select the Azure driver
        cy.findByTestId('FileSettings.DriverNamedropdown').select('azureblob');

        // * Azure fields are enabled
        cy.findByTestId('FileSettings.AzureStorageAccountinput').should('not.be.disabled');
        cy.findByTestId('FileSettings.AzureContainerinput').should('not.be.disabled');
        cy.findByTestId('FileSettings.AzurePathPrefixinput').should('not.be.disabled');
        cy.findByTestId('FileSettings.AzureAccessKeyinput').should('not.be.disabled');
        cy.findByTestId('FileSettings.AzureEndpointinput').should('not.be.disabled');
        cy.findByTestId('FileSettings.AzureRequestTimeoutMillisecondsnumber').should('not.be.disabled');

        // * S3 fields are disabled when the driver is not S3
        cy.findByTestId('FileSettings.AmazonS3Bucketinput').should('be.disabled');
        cy.findByTestId('FileSettings.AmazonS3AccessKeyIdinput').should('be.disabled');

        // * Local directory is also disabled
        cy.findByTestId('FileSettings.Directoryinput').should('be.disabled');
    });

    it('disables Azure-only fields when the S3 driver is selected', () => {
        // # Select the S3 driver
        cy.findByTestId('FileSettings.DriverNamedropdown').select('amazons3');

        // * Azure fields are disabled
        cy.findByTestId('FileSettings.AzureStorageAccountinput').should('be.disabled');
        cy.findByTestId('FileSettings.AzureContainerinput').should('be.disabled');
        cy.findByTestId('FileSettings.AzureAccessKeyinput').should('be.disabled');
    });

    it('exposes the backend-agnostic Test Connection button when Azure is selected', () => {
        // # Select the Azure driver
        cy.findByTestId('FileSettings.DriverNamedropdown').select('azureblob');

        // * The renamed button is rendered and is no longer S3-named
        cy.get('#TestFileStoreConnection').scrollIntoView().should('be.visible');
        cy.get('#TestFileStoreConnection').findByText('Test Connection').should('exist');
        cy.get('#TestS3Connection').should('not.exist');
    });
});
