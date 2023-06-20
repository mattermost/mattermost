// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

//  - Requires mmctl at fixtures folder
//  -> copy ./mmctl/mmctl to ./mattermost-webapp/e2e/cypress/tests/fixtures/mmctl

// Group: @channels @plugin @system_console

describe('System Console > Plugin Management ', () => {
    before(() => {
        cy.shouldNotRunOnCloudEdition();
    });

    it('MM-T4742 Plugin Marketplace URL should be disabled if EnableUploads are disabled', () => {
        // # Set plugin settings
        const newSettings = {
            PluginSettings: {
                Enable: true,
            },
        };
        cy.apiUpdateConfig(newSettings);

        cy.exec('tests/fixtures/mmctl --local config set PluginSettings.EnableUploads false');

        cy.visit('/admin_console/plugins/plugin_management');

        // * Verify marketplace URL is disabled.
        cy.findByTestId('marketplaceUrlinput').should('be.disabled');

        cy.exec('tests/fixtures/mmctl --local config set PluginSettings.EnableUploads true');

        cy.reload();

        // * Verify marketplace URL is enabled.
        cy.findByTestId('marketplaceUrlinput').should('be.enabled');
    });
});
