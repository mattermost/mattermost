// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify the unreads filter shows only channels with unread messages
 */
test('unreads filter will show and hide unread channels', {tag: ['@smoke', '@filters']}, async ({pw}) => {
    // # Create a user with only one team
    const {adminClient, user, team, townSquare} = await pw.initSetup();

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
    const {app} = await pw.testBrowser.login(user);
    await app.channelsPage.goto({team, channel: townSquare});

    // The sidebar link's accessible name ends in "unread", or "N mention(s)" (being added to a channel mentions
    // you), while the channel has unread messages
    const unread = / (unread|\d+ mentions?)$/;
    const link = (channel: (typeof channels)[number]) => app.lhs.channelList.channel(channel).container.locator;

    // * Verify the filter is off: all ten channels are listed, and all are unread
    for (const channel of channels) {
        await expect(link(channel)).toHaveAccessibleName(unread);
    }

    // # Visit the first five channels
    for (const channel of channels.slice(0, 5)) {
        await app.lhs.channelList.channel(channel).container.click();
        await expect(app.channelHeader.openMenuButton).toContainText(channel.display_name);
        await expect(app.channelHeader.openMenuButton).toContainText(channel.display_name);
    }

    // # Turn on the unreads filter
    await app.lhs.header.unreadsFilterToggleButton.setPressed();

    // * Verify the five unread channels are still listed
    for (const channel of channels.slice(5)) {
        await expect(link(channel)).toHaveAccessibleName(unread);
    }

    // * Verify the read channels are hidden, except the one being viewed
    for (const channel of channels.slice(0, 4)) {
        await expect(link(channel)).not.toBeVisible();
    }
    await expect(link(channels[4])).toBeVisible();
});
