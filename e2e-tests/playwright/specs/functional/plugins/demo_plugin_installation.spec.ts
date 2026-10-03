// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {demoPluginId, demoPluginUrl, test, expect} from '@mattermost/playwright-lib';

test('should install and enable demo plugin from URL', async ({pw}) => {
    // # Create and navigate to channels page
    const {adminClient, user} = await pw.initSetup();
    const {channelsPage} = await pw.testBrowser.login(user);

    await channelsPage.goto();
    await channelsPage.toBeVisible();

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
                    channelname: 'demo',
                    lastname: 'User',
                },
            },
        },
    });

    // # Install and enable
    await pw.installAndEnablePlugin(adminClient, demoPluginUrl, demoPluginId);

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
    await channelsPage.page.keyboard.press('Escape');

    // # Execute slash command
    await channelsPage.postMessage('/demo_plugin true');

    // * Verify the response post
    const post = await channelsPage.getLastPost();
    await post.toBeVisible();
    await post.toContainText('enabled');
});
