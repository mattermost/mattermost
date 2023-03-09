// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Group: @enterprise @not_cloud @system_console @license_removal

describe('System console', () => {
    before(() => {
        // * Ensure we are on self-hosted Starter edition
        cy.shouldNotRunOnCloudEdition();
        cy.apiDeleteLicense();
    });

    it('MM-T5132 License page shows View plans button', () => {
        cy.visit('/admin_console/about/license');

        // *Validate View plans button exits
        cy.get('.StarterLeftPanel').get('#starter_edition_view_plans').contains('View plans');

        // # Click View plans
        cy.get('.StarterLeftPanel').get('#starter_edition_view_plans').click();

        // *Ensure pricing modal is open
        cy.get('#pricingModal').should('exist');
    });
});
