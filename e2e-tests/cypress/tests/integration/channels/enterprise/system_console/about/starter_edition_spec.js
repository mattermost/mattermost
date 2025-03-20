// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Group: @channels @enterprise @not_cloud @system_console @license_removal

describe('System console', () => {
    before(() => {
        // * Ensure we are on self-hosted Starter edition
        cy.shouldNotRunOnCloudEdition();
        cy.apiDeleteLicense();
    });

    it('MM-T5132 License page shows View plans button that opens external pricing page', () => {
        cy.visit('/admin_console/about/license');

        // *Validate View plans button exits
        cy.get('.StarterLeftPanel').get('#starter_edition_view_plans').contains('View plans');

        // * Spy on window.open and click the button
        cy.window().then((win) => {
            cy.stub(win, 'open').as('windowOpen');
        });

        // # Click View plans
        cy.get('.StarterLeftPanel').get('#starter_edition_view_plans').click();

        // * Verify it tried to open the pricing page
        cy.get('@windowOpen').should('be.calledWith', 'https://mattermost.com/pricing', '_blank')
    });
});
