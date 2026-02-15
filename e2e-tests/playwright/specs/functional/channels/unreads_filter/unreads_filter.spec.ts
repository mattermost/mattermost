// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify the unreads filter shows only channels with unread messages
 */
test('unreads filter will show and hide unread channels', {tag: ['@smoke', '@filters']}, async ({pw}) => {
    // # Create a user with only one team
    const {adminClient, user, team} = await pw.initSetup();

    // # Create 10 channels in the team
    const channelPromises = [];
    for (let i = 0; i < 10; i++) {
        channelPromises.push(
            adminClient.createChannel(
                pw.random.channel({
                    teamId: team.id,
                    name: `test-channel-${i}`,
                    displayName: `Test Channel ${i}`,
                }),
            ),
        );
    }
    const channels = await Promise.all(channelPromises);

    // # Add user to all channels
    const addUserPromises = [];
    for (let i = 0; i < channels.length; i++) {
        addUserPromises.push(adminClient.addToChannel(user.id, channels[i].id));
    }
    await Promise.all(addUserPromises);

    // # make new posts in the channels
    const postPromises = [];
    for (let i = 0; i < channels.length; i++) {
        postPromises.push(
            adminClient.createPost({
                channel_id: channels[i].id,
                message: `Test message in channel ${i}`,
            }),
        );
    }
    await Promise.all(postPromises);

    // # Log in as the user
    const {channelsPage} = await pw.testBrowser.login(user);

    // # Visit a default channel page
    await channelsPage.goto(team.name);
    await channelsPage.toBeVisible();

    // * Verify the unreads filter is OFF initially
    expect(await channelsPage.sidebarLeft.isUnreadsFilterActive()).toBe(false);

    // * Verify all 10 test channels are initially unread
    const initialUnreadChannels = channelsPage.sidebarLeft.getUnreadChannels();
    await expect(initialUnreadChannels).toHaveCount(10);

    // # Visit 5 channels to mark them as read
    for (let i = 0; i < 5; i++) {
        await channelsPage.sidebarLeft.goToItem(channels[i].name);
    }

    // # Enable the unreads filter
    await channelsPage.sidebarLeft.toggleUnreadsFilter();

    // Verify the filter is now active
    expect(await channelsPage.sidebarLeft.isUnreadsFilterActive()).toBe(true);

    // * Verify 5 channels remain unread
    const unreadChannels = channelsPage.sidebarLeft.getUnreadChannels();
    await expect(unreadChannels).toHaveCount(5);

    // * Verify the read channels are NOT visible in sidebar when filter is active (expect the currently open channel)
    for (let i = 0; i < 4; i++) {
        const channelLink = channelsPage.sidebarLeft.container.locator(`#sidebarItem_${channels[i].name}`);
        await expect(channelLink).not.toBeVisible();
    }
});
