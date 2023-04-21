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
    it('Check boards and playbooks load when plugins are disabled', () => {
        cy.apiAdminLogin();

        // # Ensure plugins for boards and playbooks are disabled
        cy.apiUpdateConfig({
            PluginSettings: {
                PluginStates: {
                    focalboard: {
                        Enable: false,
                    },
                    playbooks: {
                        Enable: false,
                    },
                },
            },
        });

        // # Go to the Insights view
        cy.visit(`/${teamA.name}/activity-and-insights`);

        // * Check boards exists because product mode is enabled
        cy.get('.top-boards-card').should('exist');

        // * Check playbooks exists because product mode is enabled
        cy.get('.top-playbooks-card').should('exist');
    });
});
