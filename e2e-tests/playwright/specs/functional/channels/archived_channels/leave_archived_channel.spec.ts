// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify a user can leave an archived public channel and is redirected to Town Square.
 */
test('MM-T1685 leaves an archived public channel', {tag: '@channels'}, async ({pw}) => {
    // # Create a public channel and add the test user
    const {adminClient, team, user} = await pw.initSetup();
    const channel = await adminClient.createPublicChannel(team.id, `Archive Leave ${pw.random.id()}`);
    await adminClient.addToChannel(user.id, channel.id);

    // # Log in, open the channel, and archive it
    const {channelsPage, page} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();
    await channelsPage.archiveChannel();

    // # Leave the archived channel from the channel menu
    const channelMenu = await channelsPage.openChannelMenu();
    await channelMenu.leaveChannel.click();

    // * Verify the user is redirected to Town Square
    await expect(page).toHaveURL(new RegExp(`/${team.name}/channels/town-square$`));
    await channelsPage.centerView.header.toHaveTitle('Town Square');
    await expect(channelsPage.sidebarLeft.item(channel.name)).not.toBeVisible();
});
