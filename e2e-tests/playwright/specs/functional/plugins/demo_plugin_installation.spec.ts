// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {demoPluginId, demoPluginUrl, getPluginStatus, test, expect} from '@mattermost/playwright-lib';

import {sendDemoSlashCommand} from './demo_plugin/helpers';

test('should install and enable demo plugin from URL', async ({pw}) => {
    // # Create and navigate to channels page
    const {adminClient, user, team} = await pw.initSetup();
    const {app} = await pw.testBrowser.login(user);

    await app.channelsPage.goto({team, channel: {name: 'town-square'}});
    await expect(app.center.postCreate.message.container).toBeVisible();

    // # Enable public links before installing plugin
    await adminClient.patchConfig({
        FileSettings: {EnablePublicLink: true},
        ServiceSettings: {
            EnableGifPicker: true,
            EnableOnboardingFlow: false,
            EnableTutorial: false,
        },
        PluginSettings: {
            Plugins: {
                [demoPluginId]: {
                    username: 'demouser',
                    channelname: 'demo_plugin',
                    lastname: 'User',
                },
            },
        },
    });

    // # Remove any existing install, so the install below really downloads from the URL.
    // pw.installAndEnablePlugin is a no-op for an active plugin and only enables an installed
    // one, and the setup project pre-installs the demo plugin, so it would never install here.
    await adminClient.removePlugin(demoPluginId);

    // * Verify the plugin is gone
    await expect.poll(async () => (await getPluginStatus(adminClient, demoPluginId)).isInstalled).toBe(false);

    // # Install from URL and enable
    await adminClient.installPluginFromUrl(demoPluginUrl, true);
    await adminClient.enablePlugin(demoPluginId);

    // * Verify it's active (API validation, no UI)
    await expect
        .poll(async () => {
            return pw.isPluginActive(adminClient, demoPluginId);
        })
        .toBe(true);

    // * Verify plugin details
    const plugins = await adminClient.getPlugins();
    const demoPlugin = plugins.active.find((p) => p.id === demoPluginId);
    expect(demoPlugin).toBeDefined();

    // # Dismiss overlay again if it reappeared after plugin activation.
    // No fixed wait needed — postMessage's fill/click actions auto-wait for the
    // input to become interactable once the overlay clears.
    await app.page.keyboard.press('Escape');
    await expect(app.center.postCreate.message.container).toBeVisible();

    // # Execute slash command
    await sendDemoSlashCommand(app, '/demo_plugin true');

    // * Verify the response post
    await expect(async () => {
        const lastId = (await app.center.postList.postList.keys()).at(-1)!;
        await expect(app.center.postList.post({id: lastId})).toContainText('enabled');
    }).toPass();
});
