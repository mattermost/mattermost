// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @enterprise @not_cloud @system_console

import * as TIMEOUTS from '../../../../fixtures/timeouts';

describe('System console', () => {
    before(() => {
        cy.shouldNotRunOnCloudEdition();

        // * Check if server has license
        cy.apiRequireLicense();
    });

    it('MM-T897_1 - Focus should be in System Console search box on opening System Console or refreshing pages in System Console', () => {
        const pageIds = ['reporting\\/system_analytics', 'reporting\\/team_statistics', 'reporting\\/server_logs', 'user_management\\/users', 'user_management\\/teams'];
        cy.visit('/admin_console');

        // * Assert the ID of the element is the ID of admin sidebar filter
        cy.focused().should('have.id', 'adminSidebarFilter');
        cy.wait(TIMEOUTS.ONE_SEC);

        pageIds.forEach((id) => {
            // # Go to another page
            cy.get(`#${id}`).click();

            // * Ensure focus is lost
            cy.focused().should('not.have.id', 'adminSidebarFilter');

            // * Reload and ensure the focus is back on the search component
            cy.reload();
            cy.focused().should('have.id', 'adminSidebarFilter');
            cy.wait(TIMEOUTS.ONE_SEC);
        });
    });

    it('MM-T897_2 - System Console menu footer should not cut off at the bottom', () => {
        cy.visit('/admin_console');

        // * Scroll to the last item of the page and ensure it can be clicked
        cy.findByTestId('experimental.bleve').scrollIntoView().click();
    });

    it('MM-T1634 - Search box should remain visible / in the header as you scroll down the settings list in the left-hand-side', () => {
        cy.visit('/admin_console');

        // * Scroll to bottom of left hand side
        cy.findByTestId('experimental.bleve').scrollIntoView().click();

        // * To check if the sidebar is in view, try to click it
        cy.get('#adminSidebarFilter').should('be.visible').click();
    });
});
