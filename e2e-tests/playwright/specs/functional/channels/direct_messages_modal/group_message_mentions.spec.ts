// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

import {getChannelSlugFromUrl} from './helpers';

/**
 * @objective Verify a mention posted in a group message creates an unread mention for the mentioned participant.
 */
test('MM-T469 Create a group message and post a mention for another user', async ({pw}) => {
    const {adminClient, team, user} = await pw.initSetup();
    const [sender, secondParticipant] = await adminClient.createUsers(team.id, 2, 'gm-mention');
    const gmChannel = await adminClient.createGroupChannel([user.id, sender.id, secondParticipant.id]);

    // # View another channel, then have a participant mention the test user in the GM
    const {channelsPage, page} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, 'off-topic');
    await channelsPage.toBeVisible();
    await pw.stubNotification(page, 'granted');
    await adminClient.createPost({
        channel_id: gmChannel.id,
        user_id: sender.id,
        message: `@${user.username} Hello from GM`,
    });

    // * Verify a desktop notification fires for the mention
    const notifications = await pw.waitForNotification(page, 1);
    expect(notifications.length).toBeGreaterThanOrEqual(1);

    // * Verify the group message becomes unread with a mention badge
    await channelsPage.sidebarLeft.assertItemUnread(sender.username);
    await expect(channelsPage.sidebarLeft.unreadMentionsBadge(sender.username)).toBeVisible();
});

/**
 * @objective Verify that a group message can be created with a mention, closed, and then recreated with the same members.
 *
 * MM-T480 covers the same behavior as MM-T466 and is covered by this test.
 */
test(
    'MM-T466 MM-T480 creates a group message with a mention, closes it, and recreates it',
    {tag: '@direct_messages'},
    async ({pw}) => {
        // # Create the test user plus two more users on the team
        const {user, team, adminClient} = await pw.initSetup();
        const [member1, member2] = await adminClient.createUsers(team.id, 2, 'gm');

        const {channelsPage, page} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, 'town-square');
        await channelsPage.toBeVisible();

        // # Create a group message with the two members
        const dmModal = await channelsPage.openDirectChannelsModal();
        await dmModal.selectUser(member1);
        await dmModal.selectUser(member2);
        await dmModal.goToChannel();

        // # Post a message that mentions one of the members
        const token = `gm mention ${pw.random.id()}`;
        await channelsPage.postMessage(`@${member1.username} ${token}`);
        const lastPost = await channelsPage.getLastPost();
        await lastPost.toContainText(token);

        // # Close the group message conversation
        const slug = getChannelSlugFromUrl(page);
        await channelsPage.sidebarLeft.closeConversationAndWait(slug);

        // # Recreate the group message with the same members
        const dmModal2 = await channelsPage.openDirectChannelsModal();
        await dmModal2.selectUser(member1);
        await dmModal2.selectUser(member2);
        await dmModal2.goToChannel();

        // * Verify the same group message channel is reopened
        await expect.poll(() => page.url(), {timeout: pw.duration.ten_sec}).toContain(`/messages/${slug}`);
    },
);
