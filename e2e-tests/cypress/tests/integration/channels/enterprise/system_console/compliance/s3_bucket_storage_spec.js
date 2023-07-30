// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Group: @channels @enterprise @system_console @compliance_export @not_cloud

// Requires "mattermost-minio" docker instance to be accessible at http://localhost:9000
// and a bucket named "mattermost-test". Bucket can be created manually in the UI or by:
// ``docker exec mattermost-minio sh -c 'mkdir -p /data/mattermost-test'``

import * as TIMEOUTS from '../../../../../fixtures/timeouts';

import {gotoTeamAndPostImage} from './helpers';

describe('Compliance Export', () => {
    let teamName;

    before(() => {
        cy.shouldNotRunOnCloudEdition();
        cy.apiRequireLicenseForFeature('Compliance');

        cy.apiUpdateConfig({
            MessageExportSettings: {
                ExportFormat: 'csv',
                DownloadExportResults: true,
            },
        });

        cy.apiCreateCustomAdmin().then(({sysadmin}) => {
            cy.apiLogin(sysadmin);
            cy.apiInitSetup().then(({team}) => {
                teamName = team.name;
            });

            // # Visit a channel and post a message so it has something to be exported initially
            cy.visit('/');
            cy.postMessage('hello');

            // # Go to compliance page, enable export and do export
            cy.uiGoToCompliancePage();
            cy.uiEnableComplianceExport();
            cy.uiExportCompliance();
        });
    });

    it('MM-T3439 - Download Compliance Export Files - S3 Bucket Storage', () => {
        // # Go to file storage settings Page
        cy.visit('/admin_console/environment/file_storage');
        cy.get('.admin-console__header', {timeout: TIMEOUTS.ONE_MIN}).should('be.visible').and('have.text', 'File Storage');

        const {
            minioAccessKey,
            minioSecretKey,
            minioS3Bucket,
            minioS3Endpoint,
            minioS3SSL,
        } = Cypress.env();

        // # Update S3 Storage settings
        cy.findByTestId('FileSettings.DriverNamedropdown').select('amazons3');
        cy.findByTestId('FileSettings.AmazonS3Bucketinput').clear().type(minioS3Bucket);
        cy.findByTestId('FileSettings.AmazonS3AccessKeyIdinput').clear().type(minioAccessKey);
        cy.findByTestId('FileSettings.AmazonS3SecretAccessKeyinput').clear().type(minioSecretKey);
        cy.findByTestId('FileSettings.AmazonS3Endpointinput').clear().type(minioS3Endpoint);
        cy.findByTestId(`FileSettings.AmazonS3SSL${minioS3SSL}`).check();

        // # Save file storage settings
        cy.uiSaveConfig();

        // # Test connection and verify that it's successful
        cy.findByRole('button', {name: 'Test Connection'}).click();
        cy.findByText('Connection was successful').should('be.visible');

        // # Navigate to a team and post an attachment
        cy.visit(`/${teamName}/channels/town-square`);
        gotoTeamAndPostImage();

        // # Go to compliance page and start export
        cy.uiGoToCompliancePage();
        cy.uiExportCompliance();

        // # Get the first row
        cy.get('.job-table__table').find('tbody > tr').eq(0).as('firstRow');

        // # Get the download link
        cy.get('@firstRow').findByText('Download').parents('a').should('exist').then((fileAttachment) => {
            const fileURL = fileAttachment.attr('href');

            // * Download link should not exist this time
            cy.apiDownloadFileAndVerifyContentType(fileURL);
        });
    });
});
