// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as TIMEOUTS from '../../fixtures/timeouts';

Cypress.Commands.add('uiEnableComplianceExport', (exportFormat = 'csv') => {
    // * Verify that the page is loaded
    cy.findByText('Enable Compliance Export:').should('be.visible');
    cy.findByText('Compliance Export time:').should('be.visible');
    cy.findByText('Export Format:').should('be.visible');

    // # Enable compliance export
    cy.findByRole('radio', {name: /false/i}).click();
    cy.findByRole('radio', {name: /true/i}).click();

    // # Change export format
    cy.findByTestId('exportFormatdropdown').should('be.visible').select(exportFormat);

    // # Save settings
    cy.uiSaveConfig({confirm: true});
});

Cypress.Commands.add('uiGoToCompliancePage', () => {
    cy.visit('/admin_console/compliance/export');
    cy.get('.admin-console__header', {timeout: TIMEOUTS.TWO_MIN}).should('be.visible').invoke('text').should('include', 'Compliance Export');
});

Cypress.Commands.add('uiExportCompliance', () => {
    // # Click the export job button
    cy.findByRole('button', {name: /run compliance export job now/i}).click();

    // # Small wait to ensure new row is add
    cy.wait(TIMEOUTS.THREE_SEC);

    // # Get the first row
    cy.get('.job-table__table').find('tbody > tr').eq(0).as('firstRow');

    // # Get the first table header
    cy.get('.job-table__table').find('thead > tr').as('firstheader');

    // # Wait until export is finished
    cy.waitUntil(() => {
        return cy.get('@firstRow').find('td:eq(0)').then((el) => {
            return el[0].innerText.trim() === 'Success';
        });
    },
    {
        timeout: TIMEOUTS.FIVE_MIN,
        interval: TIMEOUTS.ONE_SEC,
        errorMsg: 'Compliance export did not finish in time',
    });
});

