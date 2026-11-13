// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {demoPluginId, duration, test, expect} from '@mattermost/playwright-lib';

test('should crash plugin via /crash command and verify recovery', async ({pw}) => {
    // # Setup
    const {adminClient, user} = await pw.initSetup();
    await pw.ensureDemoPlugin();
    const {channelsPage} = await pw.testBrowser.login(user);

    await channelsPage.goto();
    await channelsPage.toBeVisible();

    // # Use autocomplete to select /crash command and send it
    await channelsPage.centerView.postCreate.selectSlashCommandFromAutocomplete('/cr', '/crash');
    await channelsPage.centerView.postCreate.sendMessage();

    // * Verify the post contains the crash message
    await channelsPage.centerView.waitUntilLastPostContains('Crashing plugin');

    // * Verify the plugin recovers (polls every 500ms by default)
    await expect
        .poll(
            async () => {
                return pw.isPluginActive(adminClient, demoPluginId);
            },
            {
                timeout: duration.ten_sec, // Max 10s to recover
                intervals: [duration.one_sec], // Check every 1s
            },
        )
        .toBe(true);

    // The crash kills the plugin process mid-request. The server's auto-restart only
    // guarantees isPluginActive flips back to true — it doesn't guarantee every hook
    // (e.g. interactive dialog submit, post action callbacks) came back in a clean
    // state. ensureDemoPlugin() is a no-op once isPluginActive is true, so it can no
    // longer be relied on to paper over a partial recovery like the old unconditional
    // patchConfig-on-every-spec setup incidentally did. Force one real disable/enable
    // cycle through the same OnActivate path installAndEnablePlugin trusts, so later
    // specs in this worker don't inherit a partially-recovered plugin.
    await adminClient.disablePlugin(demoPluginId);
    await adminClient.enablePlugin(demoPluginId);
    await expect.poll(() => pw.isPluginActive(adminClient, demoPluginId), {timeout: duration.half_min}).toBe(true);

    // * Verify recovery by using /demo_plugin command
    await channelsPage.centerView.postCreate.selectSlashCommandFromAutocomplete('/demo', '/demo_plugin');
});
