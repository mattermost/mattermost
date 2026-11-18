// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {openSystemConsoleSection, settle, Api, expect, test, waitForApi, duration} from '@mattermost/playwright-lib';

/**
 * @objective Verify a system admin can install a plugin from the Marketplace, configure it
 * (landing in System Console), then remove it via Plugin Management.
 */
test(
    'MM-T4023 MM-T1987 system admin can install, configure, and remove a plugin from the Marketplace',
    {tag: '@marketplace'},
    async ({pw}) => {
        const {adminUser, team, townSquare} = await pw.initSetup();
        const {app} = await pw.testBrowser.login(adminUser);
        await app.channelsPage.goto({team, channel: townSquare});

        // # Open the App Marketplace and install the first available plugin
        await app.globalHeader.productMenu.container.clickTo(app.globalHeader.productMenu.marketplaceMenuItem);
        await app.globalHeader.productMenu.marketplaceMenuItem.click();
        // The marketplace dialog has no declared scope or plugin-row parts.
        const marketplace = app.page.getByRole('dialog', {name: 'App Marketplace'});
        await expect(marketplace).toBeVisible();
        const installButton = marketplace.getByRole('button', {name: 'Install', exact: true}).first();
        await expect(installButton).toBeVisible();
        const pluginId = await installButton.evaluate((el) => {
            const row = el.closest('[id^="marketplace-plugin-"]');
            return row ? row.id.replace('marketplace-plugin-', '') : null;
        });
        if (!pluginId) {
            throw new Error('Could not determine the plugin id for the first available "Install" button');
        }
        // Marketplace plugin rows are addressed by their id attribute; they declare no test id.
        const configureLink = marketplace
            .locator(`[id="marketplace-plugin-${pluginId}"]`)
            .getByRole('link', {name: 'Configure'});
        await Promise.all([
            waitForApi(app.page, Api.InstallMarketplacePlugin, {timeout: duration.one_min}),
            installButton.click(),
        ]);
        await expect(configureLink).toBeVisible({timeout: duration.one_min});

        // # Click "Configure", which navigates to the plugin's System Console settings page
        await configureLink.click();
        await expect(app.backstage.navbar).toBeVisible();
        await expect(app.backstage.navbar.backLink).toBeVisible();
        await expect(app.admin.sidebar).toBeVisible();

        // * Verify System Console opened directly to the installed plugin's settings page
        expect(app.page.url()).toContain(`/admin_console/plugins/plugin_${pluginId}`);

        // # Navigate to Plugin Management and remove the plugin
        await openSystemConsoleSection(app, 'plugins/plugin_management');
        const row = app.admin.plugins.plugin(pluginId);
        await row.removeButton.clickTo(app.admin.plugins.removeModal);
        await settle(app.admin.plugins.removeModal.confirmButton, {wait: Api.RemovePlugin}).click();

        // * Verify the plugin no longer appears in the installed plugins list
        await expect(row).not.toBeVisible();
    },
);
