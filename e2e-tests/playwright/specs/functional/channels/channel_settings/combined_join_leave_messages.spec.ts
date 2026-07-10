// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test} from '@mattermost/playwright-lib';

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
