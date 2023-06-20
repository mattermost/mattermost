// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @plugin_marketplace @not_cloud

import {verifyPluginMarketplaceVisibility} from './helpers';

describe('Plugin Marketplace', () => {
    let townsquareLink;
    let regularUser;

    before(() => {
        cy.apiInitSetup().then(({team, user}) => {
            regularUser = user;
            townsquareLink = `/${team.name}/channels/town-square`;
        });
    });

    beforeEach(() => {
        // # Login as sysadmin
        cy.apiAdminLogin();
    });

    it('MM-T1952 Plugin Marketplace is not available to normal users', () => {
        // # Enable Plugin Marketplace
        cy.apiUpdateConfig({
            PluginSettings: {
                Enable: true,
                EnableMarketplace: true,
                MarketplaceURL: 'https://api.integrations.mattermost.com',
            },
        });

        // # Login as non admin user
        cy.apiLogin(regularUser);
        cy.visit(townsquareLink);

        // * Verify Plugin Marketplace does not exist
        verifyPluginMarketplaceVisibility(false);
    });

    it('MM-T1957 Marketplace is not available when "Enable Marketplace" is set to false', () => {
        // # Enable Plugins
        // # Disable Plugin Marketplace
        cy.apiUpdateConfig({
            PluginSettings: {
                Enable: true,
                EnableMarketplace: false,
                MarketplaceURL: 'https://api.integrations.mattermost.com',
            },
        });

        // # Visit town-square channel
        cy.visit(townsquareLink);

        // * Verify Plugin Marketplace does not exist
        verifyPluginMarketplaceVisibility(false);
    });

    it('MM-T1959 Marketplace is not available when "Enable Plugins" is false', () => {
        // # Disable Plugins
        // # Enable Plugin Marketplace
        cy.apiUpdateConfig({
            PluginSettings: {
                Enable: false,
                EnableMarketplace: true,
                MarketplaceURL: 'https://api.integrations.mattermost.com',
            },
        });

        // # Visit town-square channel
        cy.visit(townsquareLink);

        // * Verify Plugin Marketplace does not exist
        verifyPluginMarketplaceVisibility(false);
    });
});
