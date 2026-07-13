// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify that creating and archiving a public channel in one browser session is synced in
 * real time to another session of the same user.
 */
test('MM-T837 syncs public channel create and archive across sessions', {tag: '@channel_settings'}, async ({pw}) => {
    const {user, team} = await pw.initSetup();

    // # Log in as the same user in two separate browser sessions
    const {channelsPage: firstSession} = await pw.testBrowser.login(user);
    await firstSession.goto(team.name, 'town-square');
    await firstSession.toBeVisible();

    const {channelsPage: secondSession} = await pw.testBrowser.login(user);
    await secondSession.goto(team.name, 'town-square');
    await secondSession.toBeVisible();

    // # Create a public channel in the first session
    const channelName = `RF ${pw.random.id()}`;
    await firstSession.newChannel(channelName, 'O');
    await firstSession.centerView.header.toHaveTitle(channelName);

    // * Verify the new channel appears in the sidebar of both sessions
    await expect(firstSession.sidebarLeft.container.getByText(channelName)).toBeVisible();
    await expect(secondSession.sidebarLeft.container.getByText(channelName)).toBeVisible();

    // # Archive the channel in the first session, then navigate away from the archived channel
    await firstSession.archiveChannel();
    await firstSession.sidebarLeft.goToItem('town-square');

    // * Verify the channel is removed from the sidebar of both sessions
    await expect(firstSession.sidebarLeft.container.getByText(channelName)).not.toBeVisible();
    await expect(secondSession.sidebarLeft.container.getByText(channelName)).not.toBeVisible();
});

/**
 * @objective Verify that leaving a channel in one browser session removes it from the sidebar of another
 * session that is viewing a different channel, without disrupting that other session's current view.
 */
test(
    'MM-T892 leaving a channel syncs to another session viewing a different channel',
    {tag: '@channel_settings'},
    async ({pw}) => {
        const {user, team} = await pw.initSetup();

        // # Log in as the same user in two separate browser sessions
        const {channelsPage: firstSession} = await pw.testBrowser.login(user);
        await firstSession.goto(team.name, 'town-square');
        await firstSession.toBeVisible();

        const {channelsPage: secondSession} = await pw.testBrowser.login(user);
        await secondSession.goto(team.name, 'town-square');
        await secondSession.toBeVisible();

        // # Create a public channel in the first session
        const channelName = `Leave ${pw.random.id()}`;
        await firstSession.newChannel(channelName, 'O');
        await firstSession.centerView.header.toHaveTitle(channelName);

        // * Verify the new channel appears in the second session's sidebar
        await expect(secondSession.sidebarLeft.container.getByText(channelName)).toBeVisible();

        // # Move the second session to a different channel
        await secondSession.sidebarLeft.goToItem('off-topic');
        await secondSession.centerView.header.toHaveTitle('Off-Topic');

        // # Leave the channel from the first session while still viewing it
        const channelMenu = await firstSession.openChannelMenu();
        await channelMenu.leaveChannel.click();

        // * Verify the first session is redirected to the default channel and the channel is gone from its sidebar
        await firstSession.centerView.header.toHaveTitle('Town Square');
        await expect(firstSession.sidebarLeft.container.getByText(channelName)).not.toBeVisible();

        // * Verify the second session stays on its current channel and the left channel is removed from its sidebar
        await secondSession.centerView.header.toHaveTitle('Off-Topic');
        await expect(secondSession.sidebarLeft.container.getByText(channelName)).not.toBeVisible();
    },
);
