// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

import {sendDemoSlashCommand, setupDemoPlugin} from '../../helpers';

test('should toggle hooks on and off via /demo_plugin command', async ({pw}) => {
    test.setTimeout(120000);
    // 1. Setup: install and activate the demo plugin
    const {adminClient, user, team} = await pw.initSetup();
    await setupDemoPlugin(adminClient, pw);

    // Add test user to the demo_plugin private channel (it's private; not joined by default).
    // The plugin creates this channel asynchronously on activation, so poll until it exists.
    let demoChannel: any = null;
    for (let i = 0; i < 25; i++) {
        try {
            demoChannel = await adminClient.getChannelByName(team.id, 'demo_plugin');
            if (demoChannel?.id) {
                break;
            }
        } catch {
            // Channel not yet created — wait and retry
        }
        await new Promise((resolve) => setTimeout(resolve, 2000));
    }
    if (!demoChannel?.id) {
        throw new Error('demo_plugin channel was not created within 30s of plugin activation');
    }
    await adminClient.addToChannel(user.id, demoChannel.id);

    // 2. Login
    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto();
    await channelsPage.toBeVisible();

    // 3. Navigate to the Demo Plugin channel
    await channelsPage.goto(team.name, 'demo_plugin');
    await channelsPage.toBeVisible();

    const hookStatus = channelsPage.page
        .locator('span')
        .filter({hasText: 'Demo Plugin:'})
        .locator('..')
        .locator('span')
        .last();

    // 4. Confirm last post contains login event
    const lastPost = await channelsPage.centerView.getLastPost();
    await expect(lastPost.container).not.toContainText('ChannelHasBeenCreated');

    await channelsPage.page.waitForTimeout(6000);

    // 5. Disable hooks (retry if plugin not yet ready)
    for (let attempt = 0; attempt < 4; attempt++) {
        await sendDemoSlashCommand(channelsPage.page, async () => {
            await channelsPage.centerView.postCreate.input.fill('/demo_plugin false');
            await channelsPage.centerView.postCreate.sendMessage();
        });
        try {
            await expect(hookStatus).toHaveText('Disabled', {timeout: 45000});
            break;
        } catch (err) {
            if (attempt === 3) {
                throw err;
            }
            // Re-enable without patchConfig to avoid triggering a plugin restart that
            // posts new "Demo Plugin: Enabled" messages after our disable command.
            try {
                await adminClient.enablePlugin('com.mattermost.demo-plugin');
            } catch {
                // Already enabled or transient error — ignore.
            }
            await expect
                .poll(() => pw.isPluginActive(adminClient, 'com.mattermost.demo-plugin'), {
                    timeout: 30_000,
                    intervals: [2000],
                })
                .toBe(true);
        }
    }

    // 6. Create first token channel (hooks off)
    const channel1 = pw.random.channel({
        teamId: team.id,
        name: 'hook-off-channel',
        displayName: 'Hook Off Channel',
    });
    await adminClient.createChannel(channel1);

    // 7. Confirm no ChannelHasBeenCreated post for channel1
    await expect(
        channelsPage.centerView.container.getByText(`ChannelHasBeenCreated: ~${channel1.name}`),
    ).not.toBeVisible();

    // 8. Re-enable hooks
    await sendDemoSlashCommand(channelsPage.page, async () => {
        await channelsPage.centerView.postCreate.input.fill('/demo_plugin true');
        await channelsPage.centerView.postCreate.sendMessage();
    });
    await expect(hookStatus).toHaveText('Enabled');

    // 9. Create second token channel (hooks on)
    const channel2 = pw.random.channel({
        teamId: team.id,
        name: 'hook-on-channel',
        displayName: 'Hook On Channel',
    });
    await adminClient.createChannel(channel2);

    // 10. Confirm ChannelHasBeenCreated post appears for channel2
    await expect(
        channelsPage.centerView.container.getByText(`ChannelHasBeenCreated: ~${channel2.name}`, {exact: true}),
    ).toBeVisible();
});
