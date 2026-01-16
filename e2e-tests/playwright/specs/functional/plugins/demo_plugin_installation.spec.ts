// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test, expect} from '@mattermost/playwright-lib';

test('should install and enable demo plugin from URL', async ({pw}) => {
    // Create and navigate to channels page
    const {adminClient, user} = await pw.initSetup();
    const {channelsPage} = await pw.testBrowser.login(user);

    await channelsPage.goto();
    await channelsPage.toBeVisible();

    // Enable public links before installing plugin
    await adminClient.patchConfig({
        FileSettings: {EnablePublicLink: true},
        ServiceSettings: {
            EnableOnboardingFlow: false,
            EnableTutorial: false,
        },
    });

    // Install and enable
    await pw.installAndEnablePlugin(
        adminClient,
        'https://github.com/mattermost/mattermost-plugin-demo/releases/download/v0.10.3/mattermost-plugin-demo-v0.10.3.tar.gz',
        'com.mattermost.demo-plugin',
    );

    // Verify it's active (API validation, no UI)
    await expect
        .poll(async () => {
            return await pw.isPluginActive(adminClient, 'com.mattermost.demo-plugin');
        })
        .toBe(true);

    // Optional: Get plugin details
    const plugins = await adminClient.getPlugins();
    const demoPlugin = plugins.active.find((p) => p.id === 'com.mattermost.demo-plugin');
    expect(demoPlugin).toBeDefined();

    // Dismiss overlay again if it reappeared after plugin activation
    await channelsPage.page.keyboard.press('Escape');
    await channelsPage.page.waitForTimeout(500);

    // UI Validation: Execute slash command and verify response
    await channelsPage.postMessage('/demo_plugin true');

    const post = await channelsPage.getLastPost();
    await post.toBeVisible();
    await post.toContainText('enabled');
});
