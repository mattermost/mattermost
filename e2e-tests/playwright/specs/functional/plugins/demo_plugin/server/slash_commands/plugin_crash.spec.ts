// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Api, demoPluginId, duration, expect, settle, test} from '@mattermost/playwright-lib';

test('should crash plugin via /crash command and verify recovery', async ({pw}) => {
    // # Setup
    const {adminClient, user, team} = await pw.initSetup();
    await pw.ensureDemoPlugin();
    const {app} = await pw.testBrowser.login(user);

    await app.channelsPage.goto({team, channel: {name: 'town-square'}});
    await expect(app.center.postCreate.message.container).toBeVisible();

    // # Use autocomplete to select /crash command and send it
    await app.center.postCreate.message.container.fill('/cr');
    await expect(app.center.postCreate.message.suggestions.suggestion('/crash')).toBeVisible();
    await app.center.postCreate.message.suggestions.suggestion('/crash').select();
    await expect(app.center.postCreate.message.container).toHaveValue(/^\/crash/);
    await settle(app.center.postCreate.sendButton, {wait: Api.ExecuteCommand}).click();

    // * Verify the post contains the crash message
    await expect(await app.center.postList.postList.itemWith({text: 'Crashing plugin'})).toBeVisible();

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
    await app.center.postCreate.message.container.fill('/demo');
    await expect(app.center.postCreate.message.suggestions.suggestion('/demo_plugin')).toBeVisible();
    await app.center.postCreate.message.suggestions.suggestion('/demo_plugin').select();
    await expect(app.center.postCreate.message.container).toHaveValue(/^\/demo_plugin/);
});
