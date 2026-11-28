// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Api, systemConsolePath, duration, expect, settle, test} from '@mattermost/playwright-lib';

const DEMO_PLUGIN_ID = 'com.mattermost.demo-plugin';

// Plugin rows are keyed by the manifest id.
const DEMO_PLUGIN_ROW_KEY = DEMO_PLUGIN_ID;

/**
 * @objective Verify a system admin can disable and re-enable a plugin from Plugin Management, and open its settings
 * page, which shows the plugin's id and its enable toggle.
 */
test('disables, enables and opens a plugin from Plugin Management', {tag: '@plugins'}, async ({pw}) => {
    test.setTimeout(duration.two_min);
    const {adminUser, adminClient} = await pw.initSetup();
    await pw.ensureDemoPlugin();

    // # Log in as admin and open Plugin Management
    const {app, page} = await pw.testBrowser.login(adminUser);
    await page.goto(systemConsolePath('plugins/plugin_management'));

    // * The demo plugin's row shows its id, and offers Disable since it is running
    const row = app.admin.plugins.plugin(DEMO_PLUGIN_ROW_KEY);
    await expect(row.metadata.idButton).toHaveText(DEMO_PLUGIN_ID);
    await expect(row.disableButton).toBeVisible();

    try {
        // # Disable it
        await settle(row.disableButton, {wait: Api.DisablePlugin}).click();

        // * The server stops it, and the row offers Enable
        await expect
            .poll(() => pw.isPluginActive(adminClient, DEMO_PLUGIN_ID), {timeout: duration.half_min})
            .toBe(false);
        await expect(row.enableButton).toBeVisible();

        // # Enable it again
        await settle(row.enableButton, {wait: Api.EnablePlugin}).click();

        // * The server runs it again, and the row offers Disable
        await expect
            .poll(() => pw.isPluginActive(adminClient, DEMO_PLUGIN_ID), {timeout: duration.half_min})
            .toBe(true);
        await expect(row.disableButton).toBeVisible();
    } finally {
        if (!(await pw.isPluginActive(adminClient, DEMO_PLUGIN_ID))) {
            await adminClient.enablePlugin(DEMO_PLUGIN_ID);
        }
    }

    // # Open the plugin's settings from its row
    await row.settingsLink.click();
    await expect(page).toHaveURL(new RegExp(`/admin_console/plugins/plugin_${DEMO_PLUGIN_ID.replace(/\./g, '\\.')}$`));

    // * The settings page shows the plugin's id, and its enable toggle is on
    const plugin = app.admin.plugin;
    await expect(plugin.metadata.idButton).toHaveText(DEMO_PLUGIN_ID);
    await expect(plugin.enableSwitch).toBeChecked();
});
