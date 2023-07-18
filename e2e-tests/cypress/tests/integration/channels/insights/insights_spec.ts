// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************
// Stage: @prod

describe('Insights', () => {
    let teamA;

    before(() => {
        cy.shouldHaveFeatureFlag('InsightsEnabled', true);

        cy.apiInitSetup().then(({team}) => {
            teamA = team;
        });
    });
    it('Check all the cards exist', () => {
        cy.apiAdminLogin();

        // # Go to the Insights view
        cy.visit(`/${teamA.name}/activity-and-insights`);

        // * Check top channels exists
        cy.get('.top-channels-card').should('exist');

        // * Check top threads exists
        cy.get('.top-threads-card').should('exist');

        // * Check top boards exists because product mode is enabled
        cy.get('.top-boards-card').should('exist');

        // * Check top reactions exists
        cy.get('.top-reactions-card').should('exist');

        // * Check top dms exists
        cy.get('.top-dms-card').should('exist');

        // * Check least active channels exists
        cy.get('.least-active-channels-card').should('exist');

        // * Check top playbooks exists because product mode is enabled
        cy.get('.top-playbooks-card').should('exist');
    });
});
