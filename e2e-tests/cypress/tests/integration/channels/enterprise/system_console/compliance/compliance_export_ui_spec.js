// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @enterprise @system_console @compliance_export

import * as TIMEOUTS from '../../../../../fixtures/timeouts';

import {verifyExportedMessagesCount, gotoTeamAndPostImage} from './helpers';

describe('Compliance Export', () => {
    let teamName;

    before(() => {
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

            // # Go to compliance page, enable export and do initial export
            cy.uiGoToCompliancePage();
            cy.uiEnableComplianceExport();
            cy.uiExportCompliance();
        });
    });

    it('MM-T3435 - Download Compliance Export Files - CSV Format', () => {
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

            // * Download and verify export file properties
            cy.apiDownloadFileAndVerifyContentType(fileURL);
        });
    });

    it('MM-T3438 - Download Compliance Export Files when 0 messages exported', () => {
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

            // * Download and verify export file properties
            cy.apiDownloadFileAndVerifyContentType(fileURL);

            // # Export compliance again
            cy.uiExportCompliance();

            // * Download link should not exist this time
            cy.get('.job-table__table').
                find('tbody > tr:eq(0)').
                findByText('Download').should('not.exist');
        });
    });

    it('MM-T1168 - Compliance Export - Run Now, entry appears in job table', () => {
        // # Navigate to a team and post an attachment
        cy.visit(`/${teamName}/channels/town-square`);
        gotoTeamAndPostImage();

        // # Go to compliance page and start export
        cy.uiGoToCompliancePage();
        cy.uiExportCompliance();

        // # Get the first row
        cy.get('.job-table__table').find('tbody > tr').eq(0).as('firstRow');

        // * Verify table header
        cy.get('@firstheader').within(() => {
            cy.get('th:eq(1)').should('have.text', 'Status');
            cy.get('th:eq(2)').should('have.text', 'Files');
            cy.get('th:eq(3)').should('have.text', 'Finish Time');
            cy.get('th:eq(4)').should('have.text', 'Run Time');
            cy.get('th:eq(5)').should('have.text', 'Details');
        });

        // * Verify first row (last run job) data
        cy.get('@firstRow').within(() => {
            cy.get('td:eq(1)').should('have.text', 'Success');
            cy.get('td:eq(2)').should('have.text', 'Download');
            cy.get('td:eq(4)').contains('seconds');
            cy.get('td:eq(5)').should('have.text', '1 messages exported.');
        });
    });

    it('MM-T1169 - Compliance Export - CSV and Global Relay', () => {
        // # Navigate to a team and post an attachment
        cy.visit(`/${teamName}/channels/town-square`);
        gotoTeamAndPostImage();

        // # Post 9 text messages
        Cypress._.times(9, (i) => {
            cy.postMessage(`This is the post ${i}`);
        });

        // # Go to compliance page and start export
        cy.uiGoToCompliancePage();
        cy.uiExportCompliance();

        // * 10 messages should be exported
        verifyExportedMessagesCount('10');
    });

    it('MM-T1165 - Compliance Export - Fields disabled when disabled', () => {
        // # Go to compliance page and disable export
        cy.uiGoToCompliancePage();
        cy.findByTestId('enableComplianceExportfalse').click();

        // * Verify that exported button is disabled
        cy.findByRole('button', {name: /run compliance export job now/i}).should('be.disabled');
    });

    it('MM-T1167 - Compliance Export job can be canceled', () => {
        // # Go to compliance page and enable export
        cy.uiGoToCompliancePage();
        cy.uiEnableComplianceExport();

        // # Click the export job button
        cy.findByRole('button', {name: /run compliance export job now/i}).click();

        // # Click X button to cancel import
        cy.findByTitle(/cancel/i, {timeout: TIMEOUTS.FIVE_SEC}).should('be.visible').click();

        // # Get the first row
        cy.get('.job-table__table').find('tbody > tr').eq(0).as('firstRow');

        // * Canceled text should be shown in the first row of the table
        cy.get('@firstRow').find('td:eq(1)').should('have.text', 'Canceled');
    });
});
