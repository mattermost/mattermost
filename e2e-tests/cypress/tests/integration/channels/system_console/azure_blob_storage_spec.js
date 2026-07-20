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

    it('enables Azure-only fields and hides S3-only fields when Azure is selected', () => {
        // # Select the Azure driver
        cy.findByTestId('FileSettings.DriverNamedropdown').select('azureblob');

        // * Azure fields are enabled
        cy.findByTestId('FileSettings.AzureStorageAccountinput').should('not.be.disabled');
        cy.findByTestId('FileSettings.AzureContainerinput').should('not.be.disabled');
        cy.findByTestId('FileSettings.AzurePathPrefixinput').should('not.be.disabled');
        cy.findByTestId('FileSettings.AzureAuthModedropdown').should('not.be.disabled');
        cy.findByTestId('FileSettings.AzureAccessKeyinput').should('not.be.disabled');
        cy.findByTestId('FileSettings.AzureClouddropdown').should('not.be.disabled');
        cy.findByTestId('FileSettings.AzureRequestTimeoutMillisecondsnumber').should('not.be.disabled');

        // * The cloud dropdown exposes commercial / government / custom
        cy.findByTestId('FileSettings.AzureClouddropdown').find('option[value="commercial"]').should('have.text', 'Azure Commercial');
        cy.findByTestId('FileSettings.AzureClouddropdown').find('option[value="government"]').should('have.text', 'Azure Government');
        cy.findByTestId('FileSettings.AzureClouddropdown').find('option[value="custom"]').should('have.text', 'Custom Endpoint');

        // * S3 fields are not rendered when the driver is not S3
        cy.findByTestId('FileSettings.AmazonS3Bucketinput').should('not.exist');
        cy.findByTestId('FileSettings.AmazonS3AccessKeyIdinput').should('not.exist');

        // * Local directory is disabled (still rendered)
        cy.findByTestId('FileSettings.Directoryinput').should('be.disabled');
    });

    it('shows the custom endpoint only for the Custom cloud and the SSL toggle only for the other clouds', () => {
        // # Select the Azure driver, then start on Commercial
        cy.findByTestId('FileSettings.DriverNamedropdown').select('azureblob');
        cy.findByTestId('FileSettings.AzureClouddropdown').select('commercial');

        // * Custom-only fields are hidden, SSL toggle is visible
        cy.findByTestId('FileSettings.AzureEndpointinput').should('not.exist');
        cy.findByTestId('FileSettings.AzureSSLtrue').should('not.be.disabled');

        // # Switch to Government
        cy.findByTestId('FileSettings.AzureClouddropdown').select('government');
        cy.findByTestId('FileSettings.AzureEndpointinput').should('not.exist');
        cy.findByTestId('FileSettings.AzureSSLtrue').should('not.be.disabled');

        // # Switch to Custom
        cy.findByTestId('FileSettings.AzureClouddropdown').select('custom');

        // * Custom endpoint becomes visible; SSL toggle goes away
        cy.findByTestId('FileSettings.AzureEndpointinput').should('not.be.disabled');
        cy.findByTestId('FileSettings.AzureSSLtrue').should('not.exist');
    });

    it('hides Azure-only fields when the S3 driver is selected', () => {
        // # Select the S3 driver
        cy.findByTestId('FileSettings.DriverNamedropdown').select('amazons3');

        // * Azure fields are not rendered when the driver is not Azure
        cy.findByTestId('FileSettings.AzureStorageAccountinput').should('not.exist');
        cy.findByTestId('FileSettings.AzureContainerinput').should('not.exist');
        cy.findByTestId('FileSettings.AzureAuthModedropdown').should('not.exist');
        cy.findByTestId('FileSettings.AzureAccessKeyinput').should('not.exist');
        cy.findByTestId('FileSettings.AzureClouddropdown').should('not.exist');
        cy.findByTestId('FileSettings.AzureEndpointinput').should('not.exist');
    });

    it('hides the access key when the authentication mode is default credential', () => {
        // # Select the Azure driver
        cy.findByTestId('FileSettings.DriverNamedropdown').select('azureblob');

        // * Shared key is the default and the access key is visible
        cy.findByTestId('FileSettings.AzureAuthModedropdown').should('have.value', 'shared_key');
        cy.findByTestId('FileSettings.AzureAccessKeyinput').scrollIntoView().should('be.visible');

        // # Switch to default credential
        cy.findByTestId('FileSettings.AzureAuthModedropdown').select('default_credential');

        // * The access key field is removed from the DOM
        cy.findByTestId('FileSettings.AzureAccessKeyinput').should('not.exist');

        // # Switch back to shared key
        cy.findByTestId('FileSettings.AzureAuthModedropdown').select('shared_key');

        // * The access key field reappears
        cy.findByTestId('FileSettings.AzureAccessKeyinput').scrollIntoView().should('be.visible');
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
