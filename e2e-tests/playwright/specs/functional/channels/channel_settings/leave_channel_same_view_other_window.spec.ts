// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify that leaving a channel in one session, while another session of the same user is
 * viewing that same channel, redirects both sessions to the default channel and removes it from both sidebars.
 *
 * MM-T2554 covers the same behavior as MM-T2549 and is covered by this test.
 */
test(
    'MM-T2549 MM-T2554 leaving a viewed channel redirects the other session viewing it to Town Square',
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

        // # Bring the second session to the same channel
        await expect(secondSession.sidebarLeft.container.getByText(channelName)).toBeVisible();
        await secondSession.sidebarLeft.container.getByText(channelName).click();
        await secondSession.centerView.header.toHaveTitle(channelName);

        // # Leave the channel from the first session while both sessions are viewing it
        const channelMenu = await firstSession.openChannelMenu();
        await channelMenu.leaveChannel.click();

        // * Verify the first session is redirected to Town Square and the channel is gone from its sidebar
        await firstSession.centerView.header.toHaveTitle('Town Square');
        await expect(firstSession.sidebarLeft.container.getByText(channelName)).not.toBeVisible();

        // * Verify the second session is also redirected to Town Square and the channel is removed from its sidebar
        await secondSession.centerView.header.toHaveTitle('Town Square');
        await expect(secondSession.sidebarLeft.container.getByText(channelName)).not.toBeVisible();
    },
);
