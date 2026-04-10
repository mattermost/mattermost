// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

import {setupDemoPlugin} from '../../helpers';

test('should toggle hooks on and off via /demo_plugin command', async ({pw}) => {
    // 1. Setup: install and activate the demo plugin
    const {adminClient, user, team} = await pw.initSetup();
    await setupDemoPlugin(adminClient, pw);

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

    // 5. Disable hooks
    await channelsPage.centerView.postCreate.input.fill('/demo_plugin false');
    await channelsPage.centerView.postCreate.sendMessage();
    await expect(hookStatus).toHaveText('Disabled');

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
    await channelsPage.centerView.postCreate.input.fill('/demo_plugin true');
    await channelsPage.centerView.postCreate.sendMessage();
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
