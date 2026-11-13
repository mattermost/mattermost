// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {demoPluginId, duration, expect, test} from '@mattermost/playwright-lib';

import {sendDemoSlashCommand} from '../../helpers';

test('should toggle hooks on and off via /demo_plugin command', async ({pw}) => {
    // # Setup
    const {adminClient, user, team} = await pw.initSetup();
    await pw.ensureDemoPlugin();

    // # The plugin only creates its demo_plugin channel for teams that exist when it activates, so
    // this test's new team has none yet. Re-activate the plugin so it picks up the new team.
    await adminClient.disablePlugin(demoPluginId);
    await adminClient.enablePlugin(demoPluginId);
    await expect.poll(() => pw.isPluginActive(adminClient, demoPluginId), {timeout: duration.half_min}).toBe(true);

    // # Add test user to the demo_plugin private channel (it's private; not joined by default)
    await expect
        .poll(
            () =>
                adminClient.getChannelByName(team.id, 'demo_plugin').then(
                    (c) => c.id,
                    () => '',
                ),
            {
                timeout: duration.half_min,
                intervals: [duration.two_sec],
            },
        )
        .not.toBe('');
    const demoChannel = await adminClient.getChannelByName(team.id, 'demo_plugin');
    await adminClient.addToChannel(user.id, demoChannel.id);

    // # Login
    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto();
    await channelsPage.toBeVisible();

    // # Navigate to the Demo Plugin channel
    await channelsPage.goto(team.name, 'demo_plugin');
    await channelsPage.toBeVisible();

    const hookStatus = channelsPage.page
        .locator('span')
        .filter({hasText: 'Demo Plugin:'})
        .locator('..')
        .locator('span')
        .last();

    // * Verify the last post does not contain a login event
    const lastPost = await channelsPage.centerView.getLastPost();
    await expect(lastPost.container).not.toContainText('ChannelHasBeenCreated');

    // # Disable hooks
    await sendDemoSlashCommand(channelsPage.page, async () => {
        await channelsPage.centerView.postCreate.input.fill('/demo_plugin false');
        await channelsPage.centerView.postCreate.sendMessage();
    });
    await expect(hookStatus).toHaveText('Disabled');

    // # Create first test channel (hooks off)
    const channel1 = pw.random.channel({
        teamId: team.id,
        name: 'hook-off-channel',
        displayName: 'Hook Off Channel',
    });
    await adminClient.createChannel(channel1);

    // * Verify no ChannelHasBeenCreated post for channel1
    await expect(
        channelsPage.centerView.container.getByText(`ChannelHasBeenCreated: ~${channel1.name}`),
    ).not.toBeVisible();

    // # Re-enable hooks
    await sendDemoSlashCommand(channelsPage.page, async () => {
        await channelsPage.centerView.postCreate.input.fill('/demo_plugin true');
        await channelsPage.centerView.postCreate.sendMessage();
    });

    // * Verify the indicator shows Enabled
    await expect(hookStatus).toHaveText('Enabled');

    // # Create second test channel (hooks on)
    const channel2 = pw.random.channel({
        teamId: team.id,
        name: 'hook-on-channel',
        displayName: 'Hook On Channel',
    });
    await adminClient.createChannel(channel2);

    // * Verify ChannelHasBeenCreated post appears for channel2
    await expect(
        channelsPage.centerView.container.getByText(`ChannelHasBeenCreated: ~${channel2.name}`, {exact: true}),
    ).toBeVisible();
});
