// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @not_cloud @bot_accounts

import * as TIMEOUTS from '../../fixtures/timeouts';

describe('Bot accounts ownership and API', () => {
    let newTeam;

    before(() => {
        cy.shouldNotRunOnCloudEdition();

        cy.apiInitSetup({
            promoteNewUserAsAdmin: true,
            loginAfter: true,
        }).then(({team}) => {
            newTeam = team;
        });

        // # Set ServiceSettings to expected values
        const newSettings = {
            ServiceSettings: {
                DisableBotsWhenOwnerIsDeactivated: true,
            },
        };
        cy.apiUpdateConfig(newSettings);
    });

    it('MM-T1861 Bots do not re-enable if the owner is re-activated', () => {
        // # Create another admin account
        cy.apiCreateCustomAdmin().then(({sysadmin}) => {
            // # Login as the new admin
            cy.apiLogin(sysadmin);

            // # Create a new bot as the new admin
            cy.apiCreateBot({prefix: 'stay-enabled-bot'}).then(({bot}) => {
                // # Login again as main admin
                cy.apiAdminLogin();

                // # Deactivate the newly created admin
                cy.apiDeactivateUser(sysadmin.id);

                // # Get bot list
                cy.visit(`/${newTeam.name}/integrations/bots`);

                // # Search for the other bot
                cy.get('#searchInput', {timeout: TIMEOUTS.ONE_MIN}).type(bot.username);

                // * Validate that the plugin is disabled since its owner is deactivated
                cy.get('.bot-list__disabled').scrollIntoView().should('be.visible');

                // # Re-activate the newly created admin
                cy.apiActivateUser(sysadmin.id);

                // # Repeat the test to confirm it stays disabled

                // # Get bot list
                cy.visit(`/${newTeam.name}/integrations/bots`);

                // # Search for the other bot
                cy.get('#searchInput', {timeout: TIMEOUTS.ONE_MIN}).type(bot.username);

                // * Validate that the plugin is disabled even though its owner is activated
                cy.get('.bot-list__disabled').scrollIntoView().should('be.visible');
            });
        });
    });
});
