// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @bot_accounts @plugin @not_cloud

import * as TIMEOUTS from '../../../fixtures/timeouts';
import {matterpollPlugin} from '../../../utils/plugins';

describe('Managing bot accounts', () => {
    let newTeam;

    before(() => {
        cy.shouldNotRunOnCloudEdition();
        cy.shouldHavePluginUploadEnabled();

        // # Create and visit new channel
        cy.apiInitSetup().then(({team}) => {
            newTeam = team;
        });
    });

    beforeEach(() => {
        cy.apiAdminLogin();
    });

    it('MM-T1859 Bot is kept active when owner is disabled', () => {
        // # Visit bot config
        cy.visit('/admin_console/integrations/bot_accounts');

        // # Click 'false' to disable
        cy.findByTestId('ServiceSettings.DisableBotsWhenOwnerIsDeactivatedfalse', {timeout: TIMEOUTS.ONE_MIN}).click();

        // # Save
        cy.findByTestId('saveSetting').should('be.enabled').click();

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
                cy.get('#searchInput', {timeout: TIMEOUTS.ONE_MIN}).type(bot.display_name);

                // * Validate that the plugin is still active, even though its owner is disabled
                cy.get('.bot-list__disabled').should('not.exist');
                cy.findByText(bot.fullDisplayName).scrollIntoView().should('be.visible');

                cy.visit(`/${newTeam.name}/messages/@sysadmin`);

                // # Get last post message text
                cy.getLastPostId().then((postId) => {
                    cy.get(`#postMessageText_${postId}`).as('postMessageText');
                });

                // * Verify entire message
                cy.get('@postMessageText').
                    should('be.visible').
                    and('contain.text', `${sysadmin.username} was deactivated. They managed the following bot accounts`).
                    and('contain.text', bot.username);
            });
        });
    });

    it('MM-T1853 Bots managed plugins can be created when Enable Bot Account Creation is set to false', () => {
        // # Upload and enable "matterpoll" plugin
        cy.apiUploadAndEnablePlugin(matterpollPlugin);

        // # Visit bot config
        cy.visit('/admin_console/integrations/bot_accounts');

        // # Click 'false' to disable
        cy.findByTestId('ServiceSettings.EnableBotAccountCreationfalse', {timeout: TIMEOUTS.ONE_MIN}).click();

        // # Save
        cy.findByTestId('saveSetting').should('be.enabled').click();

        // # Visit the integrations
        cy.visit(`/${newTeam.name}/integrations/bots`);

        // * Validate that plugin installed ok
        cy.contains('Matterpoll (@matterpoll)', {timeout: TIMEOUTS.ONE_MIN});
    });
});
