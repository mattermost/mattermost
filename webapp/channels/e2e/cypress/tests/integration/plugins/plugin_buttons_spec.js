// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @plugin @not_cloud

import * as TIMEOUTS from '../../fixtures/timeouts';
import {demoPlugin, testPlugin} from '../../utils/plugins';

describe('collapse on 15 plugin buttons', () => {
    let testTeam;

    before(() => {
        cy.shouldNotRunOnCloudEdition();
        cy.shouldHavePluginUploadEnabled();

        // # Login as Admin
        cy.apiInitSetup().then(({team}) => {
            testTeam = team;
        });

        // # Uninstall all plugins
        cy.apiUninstallAllPlugins();
    });

    it('MM-T1649 Greater than 15 plugin buttons collapse to one icon in top nav', () => {
        // # Go to town square
        cy.visit(`/${testTeam.name}/channels/town-square`);

        // # Upload and enable test plugin with 15 channel header icons
        cy.apiUploadAndEnablePlugin(testPlugin).then(() => {
            cy.wait(TIMEOUTS.TWO_SEC);

            // # Get number of channel header icons
            cy.get('.channel-header__icon').its('length').then((icons) => {
                // # Upload and enable demo plugin with one additional channel header icon
                cy.apiUploadAndEnablePlugin(demoPlugin).then(() => {
                    cy.wait(TIMEOUTS.TWO_SEC);

                    const maxPluginHeaderCount = 15;

                    // * Validate that channel header icons collapsed and number is reduced by 14
                    cy.get('.channel-header__icon').should('have.length', icons - (maxPluginHeaderCount - 1));

                    // * Validate that plugin count is 16 (15 from test plugin and 1 from demo plugin)
                    cy.get('#pluginCount').should('have.text', maxPluginHeaderCount + 1);

                    // # click plugin channel header
                    cy.get('#pluginChannelHeaderButtonDropdown').click();

                    // * Verify dropdown menu exists
                    cy.get('ul.dropdown-menu.channel-header_plugin-dropdown').should('exist');

                    // * Verify the plugin icons expand out to show individually rather than being collapsed behind one icon
                    cy.apiDisablePluginById(demoPlugin.id).then(() => {
                        cy.wait(TIMEOUTS.TWO_SEC);
                        cy.get('.channel-header__icon').should('have.length', icons);
                    });
                });
            });
        });
    });
});
