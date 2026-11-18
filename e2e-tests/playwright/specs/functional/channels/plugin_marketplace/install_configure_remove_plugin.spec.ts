// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Api, expect, settle, test, systemConsolePath, duration, waitForApi} from '@mattermost/playwright-lib';

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
        const [plugins] = await Promise.all([
            waitForApi(page, Api.GetMarketplacePlugins),
            productMenu.marketplaceMenuItem.clickTo(marketplace),
        ]);
        const key = plugins.find((plugin) => !plugin.installed_version)?.manifest.id;
        if (!key) {
            throw new Error('Expected the Marketplace to offer a plugin that is not installed');
        }
        const item = marketplace.plugin(key);
        await expect(item).toBeVisible();
        await settle(item.installButton, {wait: Api.InstallMarketplacePlugin, timeout: duration.one_min}).click();
        await expect(item.configureLink).toBeVisible({timeout: duration.one_min});

        // # Click "Configure", which navigates to the plugin's System Console settings page
        await item.configureLink.click();
        await expect(page).toHavePath(systemConsolePath(`plugins/plugin_${key}`));
        await expect(app.backstage.navbar).toBeVisible();
        await expect(app.backstage.navbar.backLink).toBeVisible();
        await expect(app.admin.sidebar).toBeVisible();
        await expect(app.admin.sidebar.header.menu.container).toBeVisible();
        await expect(app.admin.sidebar.header.menu.container).toContainText('System Console');
        await expect(app.admin.sidebar.filter.container).toBeVisible();
        await expect(app.admin.plugin.metadata.idButton).toBeVisible();
        await expect(app.admin.plugin.metadata.idButton).toHaveText(key);

        // # Navigate to Plugin Management and remove the plugin
        await page.goto(systemConsolePath('plugins/plugin_management'));
        await expect(app.admin.header).toContainText('Plugin Management');
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
