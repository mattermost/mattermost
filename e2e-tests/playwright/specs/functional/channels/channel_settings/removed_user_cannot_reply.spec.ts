// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify that a user viewing a thread in the right-hand side can no longer reply once they are
 * removed from the channel.
 */
test(
    'MM-T843 removes the reply box in the right-hand side after the user is removed from the channel',
    {tag: '@channel_settings'},
    async ({pw}) => {
        const {adminClient, adminUser, team, user} = await pw.initSetup();

        // # Create a channel, add the user, and post a root message as the admin
        const channel = await adminClient.createPublicChannel(team.id, `Remove ${pw.random.id()}`);
        await adminClient.addToChannel(user.id, channel.id);
        const rootMessage = `root ${pw.random.id()}`;
        await adminClient.createPost({channel_id: channel.id, user_id: adminUser.id, message: rootMessage});

        // # Log in as the user and open the thread in the right-hand side
        const {channelsPage} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, channel.name);
        await channelsPage.toBeVisible();
        const rootPost = await channelsPage.getLastPost();
        await rootPost.reply();
        await channelsPage.sidebarRight.toBeVisible();

        // # Post a reply in the right-hand side
        const reply = `reply ${pw.random.id()}`;
        await channelsPage.sidebarRight.postMessage(reply);
        await channelsPage.sidebarRight.toContainText(reply);

        // * Verify the reply box is available before removal
        await expect(channelsPage.sidebarRight.postCreate.input).toBeVisible();

        // # Remove the user from the channel
        await adminClient.removeFromChannel(user.id, channel.id);

        // * Verify the reply box in the right-hand side is no longer available
        await expect(channelsPage.sidebarRight.postCreate.input).not.toBeVisible({timeout: pw.duration.ten_sec});
    },
);
