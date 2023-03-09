// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @system_console

import * as TIMEOUTS from '../../../fixtures/timeouts';

describe('Settings', () => {
    before(() => {
        cy.apiRequireLicense();
    });

    it('MM-T1181 Compliance and Auditing: Run a report, it appears in the job table', () => {
        cy.visit('/admin_console/compliance/monitoring');

        // # Enable compliance reporting
        cy.findByTestId('ComplianceSettings.Enabletrue').click();

        cy.findByTestId('saveSetting').should('be.enabled').click().wait(TIMEOUTS.HALF_SEC);

        // # Fill up the boxes
        cy.get('#desc').clear().type('sample report');
        const now = new Date();
        cy.get('#to').clear().type(now.toLocaleDateString());
        now.setDate(now.getDate() - 1);
        cy.get('#from').clear().type(now.toLocaleDateString());

        // # Run compliance reports
        cy.get('#run-button').click().wait(TIMEOUTS.HALF_SEC);

        cy.findByText('Reload Completed Compliance Reports').click().wait(TIMEOUTS.HALF_SEC);

        // * Ensure that reports appear
        cy.get('.compliance-panel__table tbody').children().should('have.length.greaterThan', 0);

        // * Ensure that the report is correct
        cy.get('.compliance-panel__table tbody tr').first().should('contain.text', 'Download');
        cy.get('.compliance-panel__table tbody tr').first().should('contain.text', 'sample report');
    });

    it('MM-T1635 Channel listing is displayed correctly with proper team name', () => {
        let teamName;
        cy.visit('/admin_console/user_management/channels');

        // # Get the team name
        cy.get('#channels .DataGrid .DataGrid_rows > :nth-child(1)').
            within(() => {
                cy.get('.DataGrid_cell:nth-of-type(2)').
                    invoke('text').
                    then((name) => {
                        teamName = name;

                        // # Click on the channel
                        return cy.get('.DataGrid_cell').first().click();
                    });
            }).then(() => {
                // * Confirm that the team name is same
                cy.get('#channel_profile .channel-team').should('have.text', 'Team' + teamName);
            });
    });
});
