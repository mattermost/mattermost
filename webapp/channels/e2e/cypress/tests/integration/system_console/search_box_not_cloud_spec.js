// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @not_cloud @system_console

import * as TIMEOUTS from '../../fixtures/timeouts';

describe('System console', () => {
    before(() => {
        cy.shouldNotRunOnCloudEdition();
        cy.shouldHavePluginUploadEnabled();
    });

    it('MM-T898 - Individual plugins can be searched for via the System Console search box', () => {
        cy.visit('/admin_console');

        // # Enable Plugin Marketplace and Remote Marketplace
        cy.apiUpdateConfig({
            PluginSettings: {
                Enable: true,
                EnableMarketplace: true,
                EnableRemoteMarketplace: true,
                MarketplaceURL: 'https://api.integrations.mattermost.com',
            },
        });

        cy.apiInstallPluginFromUrl('https://github.com/mattermost/mattermost-plugin-antivirus/releases/download/v0.1.2/antivirus-0.1.2.tar.gz', true);
        cy.apiInstallPluginFromUrl('https://github.com/mattermost/mattermost-plugin-autolink/releases/download/v1.2.1/mattermost-autolink-1.2.1.tar.gz', true);
        cy.apiInstallPluginFromUrl('https://github.com/mattermost/mattermost-plugin-aws-SNS/releases/download/v1.1.0/com.mattermost.aws-sns-1.1.0.tar.gz', true);

        // # A bug with the endpoint used for downloading plugins which doesn't send websocket events out so state is not updated
        // # Therefore, we visit town-square to update the state of our app then re-visit admin console
        cy.visit('ad-1/channels/town-square');
        cy.visit('/admin_console');

        // # Type first plugin name
        cy.get('#adminSidebarFilter').type('Anti');
        cy.wait(TIMEOUTS.ONE_SEC);

        // * Ensure anti virus plugin is highlighted
        cy.get('#plugins\\/plugin_antivirus').then((el) => {
            expect(el[0].innerHTML).includes('markjs');
        });

        // # Type second plugin name
        cy.get('#adminSidebarFilter').clear().type('Auto');
        cy.wait(TIMEOUTS.ONE_SEC);

        // * Ensure autolink plugin is highlighted
        cy.get('#plugins\\/plugin_mattermost-autolink').then((el) => {
            expect(el[0].innerHTML).includes('markjs');
        });

        // # Type third plugin name
        cy.get('#adminSidebarFilter').clear().type('AWS SN');
        cy.wait(TIMEOUTS.ONE_SEC);

        // * Ensure aws sns plugin is highlighted
        cy.get('#plugins\\/plugin_com\\.mattermost\\.aws-sns').then((el) => {
            expect(el[0].innerHTML).includes('markjs');
        });

        cy.apiUninstallAllPlugins();
    });
});
