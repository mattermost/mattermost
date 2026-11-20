// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Api, expect, settle, test, systemConsolePath, duration} from '@mattermost/playwright-lib';

/**
 * @objective Verify a system admin can install a plugin from the Marketplace, configure it
 * (landing in System Console), then remove it via Plugin Management.
 */
test(
    'MM-T4023 MM-T1987 system admin can install, configure, and remove a plugin from the Marketplace',
    {tag: '@marketplace'},
    async ({pw}) => {
        const {adminUser, team, townSquare} = await pw.initSetup();
        const {app, page} = await pw.testBrowser.login(adminUser);
        await app.channelsPage.goto({team, channel: townSquare});
        await expect(app.center.postCreate.message.container).toBeVisible();

        // # Open the App Marketplace and install the first plugin that isn't installed yet
        const productMenu = app.globalHeader.productMenu;
        await productMenu.container.click();
        await expect(productMenu.marketplaceMenuItem).toBeVisible();
        const marketplace = app.marketplaceModal;
        await productMenu.marketplaceMenuItem.clickTo(marketplace);
        await expect(marketplace).toBeVisible();
        await expect(await marketplace.pluginList.first()).toBeVisible();
        let key = '';
        for (const k of await marketplace.pluginList.keys()) {
            if (await marketplace.plugin(k).installButton.isVisible()) {
                key = k;
                break;
            }
        }
        expect(key).not.toBe('');
        const item = marketplace.plugin(key);
        await settle(item.installButton, {wait: Api.InstallMarketplacePlugin, timeout: duration.one_min}).click();
        await expect(item.configureLink).toBeVisible({timeout: duration.one_min});

        // # Click "Configure", which navigates to the plugin's System Console settings page
        await item.configureLink.click();
        await expect.poll(() => page.url()).toContain(`/admin_console/plugins/plugin_${key}`);
        await expect(app.backstage.navbar).toBeVisible();
        await expect(app.backstage.navbar.backLink).toBeVisible();
        await expect(app.admin.sidebar).toBeVisible();
        await expect(app.admin.sidebar.header.menu.container).toBeVisible();
        // The sidebar header has no title part, so the System Console title is read inside its generated menu button.
        await expect(app.admin.sidebar.header.menu.container.locator.getByText('System Console')).toBeVisible();
        await expect(app.admin.sidebar.filter.container).toBeVisible();
        await expect(app.admin.plugin.metadata.idButton).toBeVisible();
        await expect(app.admin.plugin.metadata.idButton).toHaveText(key);

        // * Verify System Console opened directly to the installed plugin's settings page
        const pluginId = (await app.admin.plugin.metadata.idButton.locator.textContent())?.trim() ?? '';
        expect(pluginId).not.toBe('');
        expect(pluginId).toBe(key);

        // # Navigate to Plugin Management and remove the plugin
        await page.goto(systemConsolePath('plugins/plugin_management'));
        // The shared admin header has no title part, so the Plugin Management page's title is read from the header.
        await expect(app.admin.header.locator.getByText('Plugin Management', {exact: true})).toBeVisible();
        const row = app.admin.plugins.plugin(key);
        await expect(row).toBeVisible();
        const removeModal = app.admin.plugins.removeModal;
        await row.removeButton.clickTo(removeModal);
        await settle(removeModal.confirmButton, {wait: Api.RemovePlugin, params: {plugin_id: key}}).click();
        await expect(removeModal).not.toBeVisible();

        // * Verify the plugin no longer appears in the installed plugins list
        await expect(row).not.toBeVisible();
    },
);
