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

/**
 * @objective Verify that users added to a public channel in one batch are combined into a single system
 * message, while a user added after an intervening post produces a separate system message.
 */
test(
    'MM-T858 combines consecutive join messages and separates them across posts',
    {tag: '@channel_settings'},
    async ({pw}) => {
        const {adminClient, team, user} = await pw.initSetup();
        const [member1, member2, member3] = await adminClient.createUsers(team.id, 3, 'join-leave');
        const channel = await adminClient.createPublicChannel(team.id, `Messages ${pw.random.id()}`);
        await adminClient.addToChannel(user.id, channel.id);

        const {channelsPage} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, channel.name);
        await channelsPage.toBeVisible();

        // # Post a message to seal the setup system messages into their own group
        await channelsPage.postMessage(`setup ${pw.random.id()}`);

        // # Add two members to the channel in quick succession
        await adminClient.addToChannel(member1.id, channel.id);
        await adminClient.addToChannel(member2.id, channel.id);

        // * Verify both members are combined into a single "added to the channel" system message
        await channelsPage.centerView.waitUntilLastPostContains('added to the channel');
        const combinedPost = await channelsPage.getLastPost();
        await combinedPost.toContainText(member1.username);
        await combinedPost.toContainText(member2.username);

        // # Post a message, then add a third member after it
        await channelsPage.postMessage(`divider ${pw.random.id()}`);
        await adminClient.addToChannel(member3.id, channel.id);

        // * Verify the third member produces a separate system message that does not include the earlier members
        await channelsPage.centerView.waitUntilLastPostContains('added to the channel');
        const separatePost = await channelsPage.getLastPost();
        await separatePost.toContainText(member3.username);
        await separatePost.toNotContainText(member1.username);
    },
);
