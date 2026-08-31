// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify a system admin can install a plugin from the Marketplace, configure it
 * (landing in System Console), then remove it via Plugin Management.
 */
test(
    'MM-T4023 MM-T1987 system admin can install, configure, and remove a plugin from the Marketplace',
    {tag: '@marketplace'},
    async ({pw}) => {
        const {adminUser, team} = await pw.initSetup();
        const {channelsPage, systemConsolePage} = await pw.testBrowser.login(adminUser);
        await channelsPage.goto(team.name, 'town-square');
        await channelsPage.toBeVisible();

        // # Open the App Marketplace and install the first available plugin
        await channelsPage.globalHeader.openAppMarketplace();
        const marketplace = channelsPage.marketplaceModal;
        await marketplace.toBeVisible();
        const pluginId = await marketplace.installFirstAvailablePlugin();

        // # Click "Configure", which navigates to the plugin's System Console settings page
        await marketplace.clickConfigure(pluginId);
        await systemConsolePage.toBeVisible();

        // * Verify System Console opened directly to the installed plugin's settings page
        expect(systemConsolePage.page.url()).toContain(`/admin_console/plugins/plugin_${pluginId}`);

        // # Navigate to Plugin Management and remove the plugin
        await systemConsolePage.gotoPluginManagement();
        await systemConsolePage.pluginManagement.toBeVisible();
        await systemConsolePage.pluginManagement.removePlugin(pluginId);

        // * Verify the plugin no longer appears in the installed plugins list
        await systemConsolePage.pluginManagement.notToHavePlugin(pluginId);
    },
);
