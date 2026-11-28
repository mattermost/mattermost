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
        cy.get('[data-testid="admin.setting:FileSettings.DriverName--group"] [data-testid="admin.setting.choice--combobox"]').should('be.visible');
    });

    it('shows the Azure Blob Storage option in the File Storage System dropdown', () => {
        // * Verify the Azure option is present alongside Local and S3
        cy.get('[data-testid="admin.setting:FileSettings.DriverName--group"] [data-testid="admin.setting.choice--combobox"]').
            find('option[value="azureblob"]').
            should('have.text', 'Azure Blob Storage');
    });

    it('enables Azure-only fields and hides S3-only fields when Azure is selected', () => {
        // # Select the Azure driver
        cy.get('[data-testid="admin.setting:FileSettings.DriverName--group"] [data-testid="admin.setting.choice--combobox"]').select('azureblob');

        // * Azure fields are enabled
        cy.get('[data-testid="admin.setting:FileSettings.AzureStorageAccount--group"] [data-testid="admin.setting.value--textbox"]').should('not.be.disabled');
        cy.get('[data-testid="admin.setting:FileSettings.AzureContainer--group"] [data-testid="admin.setting.value--textbox"]').should('not.be.disabled');
        cy.get('[data-testid="admin.setting:FileSettings.AzurePathPrefix--group"] [data-testid="admin.setting.value--textbox"]').should('not.be.disabled');
        cy.get('[data-testid="admin.setting:FileSettings.AzureAuthMode--group"] [data-testid="admin.setting.choice--combobox"]').should('not.be.disabled');
        cy.get('[data-testid="admin.setting:FileSettings.AzureAccessKey--group"] [data-testid="admin.setting.value--textbox"]').should('not.be.disabled');
        cy.get('[data-testid="admin.setting:FileSettings.AzureCloud--group"] [data-testid="admin.setting.choice--combobox"]').should('not.be.disabled');
        cy.get('[data-testid="admin.setting:FileSettings.AzureRequestTimeoutMilliseconds--group"] [data-testid="admin.setting.number--spinbutton"]').should('not.be.disabled');

        // * The cloud dropdown exposes commercial / government / custom
        cy.get('[data-testid="admin.setting:FileSettings.AzureCloud--group"] [data-testid="admin.setting.choice--combobox"]').find('option[value="commercial"]').should('have.text', 'Azure Commercial');
        cy.get('[data-testid="admin.setting:FileSettings.AzureCloud--group"] [data-testid="admin.setting.choice--combobox"]').find('option[value="government"]').should('have.text', 'Azure Government');
        cy.get('[data-testid="admin.setting:FileSettings.AzureCloud--group"] [data-testid="admin.setting.choice--combobox"]').find('option[value="custom"]').should('have.text', 'Custom Endpoint');

        // * S3 fields are not rendered when the driver is not S3
        cy.get('[data-testid="admin.setting:FileSettings.AmazonS3Bucket--group"] [data-testid="admin.setting.value--textbox"]').should('not.exist');
        cy.get('[data-testid="admin.setting:FileSettings.AmazonS3AccessKeyId--group"] [data-testid="admin.setting.value--textbox"]').should('not.exist');

        // * Local directory is disabled (still rendered)
        cy.get('[data-testid="admin.setting:FileSettings.Directory--group"] [data-testid="admin.setting.value--textbox"]').should('be.disabled');
    });

    it('shows the custom endpoint only for the Custom cloud and the SSL toggle only for the other clouds', () => {
        // # Select the Azure driver, then start on Commercial
        cy.get('[data-testid="admin.setting:FileSettings.DriverName--group"] [data-testid="admin.setting.choice--combobox"]').select('azureblob');
        cy.get('[data-testid="admin.setting:FileSettings.AzureCloud--group"] [data-testid="admin.setting.choice--combobox"]').select('commercial');

        // * Custom-only fields are hidden, SSL toggle is visible
        cy.get('[data-testid="admin.setting:FileSettings.AzureEndpoint--group"] [data-testid="admin.setting.value--textbox"]').should('not.exist');
        cy.get('[data-testid="admin.setting:FileSettings.AzureSSL--group"] [data-testid="admin.setting.true--radio"]').should('not.be.disabled');

        // # Switch to Government
        cy.get('[data-testid="admin.setting:FileSettings.AzureCloud--group"] [data-testid="admin.setting.choice--combobox"]').select('government');
        cy.get('[data-testid="admin.setting:FileSettings.AzureEndpoint--group"] [data-testid="admin.setting.value--textbox"]').should('not.exist');
        cy.get('[data-testid="admin.setting:FileSettings.AzureSSL--group"] [data-testid="admin.setting.true--radio"]').should('not.be.disabled');

        // # Switch to Custom
        cy.get('[data-testid="admin.setting:FileSettings.AzureCloud--group"] [data-testid="admin.setting.choice--combobox"]').select('custom');

        // * Custom endpoint becomes visible; SSL toggle goes away
        cy.get('[data-testid="admin.setting:FileSettings.AzureEndpoint--group"] [data-testid="admin.setting.value--textbox"]').should('not.be.disabled');
        cy.get('[data-testid="admin.setting:FileSettings.AzureSSL--group"] [data-testid="admin.setting.true--radio"]').should('not.exist');
    });

    it('hides Azure-only fields when the S3 driver is selected', () => {
        // # Select the S3 driver
        cy.get('[data-testid="admin.setting:FileSettings.DriverName--group"] [data-testid="admin.setting.choice--combobox"]').select('amazons3');

        // * Azure fields are not rendered when the driver is not Azure
        cy.get('[data-testid="admin.setting:FileSettings.AzureStorageAccount--group"] [data-testid="admin.setting.value--textbox"]').should('not.exist');
        cy.get('[data-testid="admin.setting:FileSettings.AzureContainer--group"] [data-testid="admin.setting.value--textbox"]').should('not.exist');
        cy.get('[data-testid="admin.setting:FileSettings.AzureAuthMode--group"] [data-testid="admin.setting.choice--combobox"]').should('not.exist');
        cy.get('[data-testid="admin.setting:FileSettings.AzureAccessKey--group"] [data-testid="admin.setting.value--textbox"]').should('not.exist');
        cy.get('[data-testid="admin.setting:FileSettings.AzureCloud--group"] [data-testid="admin.setting.choice--combobox"]').should('not.exist');
        cy.get('[data-testid="admin.setting:FileSettings.AzureEndpoint--group"] [data-testid="admin.setting.value--textbox"]').should('not.exist');
    });

    it('hides the access key when the authentication mode is default credential', () => {
        // # Select the Azure driver
        cy.get('[data-testid="admin.setting:FileSettings.DriverName--group"] [data-testid="admin.setting.choice--combobox"]').select('azureblob');

        // * Shared key is the default and the access key is visible
        cy.get('[data-testid="admin.setting:FileSettings.AzureAuthMode--group"] [data-testid="admin.setting.choice--combobox"]').should('have.value', 'shared_key');
        cy.get('[data-testid="admin.setting:FileSettings.AzureAccessKey--group"] [data-testid="admin.setting.value--textbox"]').scrollIntoView().should('be.visible');

        // # Switch to default credential
        cy.get('[data-testid="admin.setting:FileSettings.AzureAuthMode--group"] [data-testid="admin.setting.choice--combobox"]').select('default_credential');

        // * The access key field is removed from the DOM
        cy.get('[data-testid="admin.setting:FileSettings.AzureAccessKey--group"] [data-testid="admin.setting.value--textbox"]').should('not.exist');

        // # Switch back to shared key
        cy.get('[data-testid="admin.setting:FileSettings.AzureAuthMode--group"] [data-testid="admin.setting.choice--combobox"]').select('shared_key');

        // * The access key field reappears
        cy.get('[data-testid="admin.setting:FileSettings.AzureAccessKey--group"] [data-testid="admin.setting.value--textbox"]').scrollIntoView().should('be.visible');
    });

    it('exposes the backend-agnostic Test Connection button when Azure is selected', () => {
        // # Select the Azure driver
        cy.get('[data-testid="admin.setting:FileSettings.DriverName--group"] [data-testid="admin.setting.choice--combobox"]').select('azureblob');

        // * The renamed button is rendered and is no longer S3-named
        cy.get('#TestFileStoreConnection').scrollIntoView().should('be.visible');
        cy.get('#TestFileStoreConnection').findByText('Test Connection').should('exist');
        cy.get('#TestS3Connection').should('not.exist');
    });
});
