// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @zephyr MM-T3125
 * @objective Verify reply functionality in group message (GM) threads
 * @test_steps
 * 1. User1 in a GM posts a message
 * 2. User2 in that GM clicks the Reply arrow on the message
 * 3. User2 sees RHS open with that message at the top and a reply box
 * 4. User2 types a reply and clicks to send or presses Enter
 */
test('MM-T3125 reply in existing GM', {tag: '@channels'}, async ({pw}) => {
    const {adminClient, user, team, userClient} = await pw.initSetup();

    // # Create User2 and User3 for the group message (GM requires 3+ users)
    const user2 = await adminClient.createUser(pw.random.user(), '', '');
    await adminClient.addToTeam(team.id, user2.id);

    const user3 = await adminClient.createUser(pw.random.user(), '', '');
    await adminClient.addToTeam(team.id, user3.id);

    // # Create a group channel (GM) with all three users
    const gmChannel = await userClient.createGroupChannel([user.id, user2.id, user3.id]);

    // # Post a message via API as the main user
    const originalMessage = `Test message at ${Date.now()}`;
    const originalPost = await userClient.createPost({
        channel_id: gmChannel.id,
        message: originalMessage,
    });

    // # Login as main user and navigate to GM
    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, gmChannel.name);
    await channelsPage.toBeVisible();

    // * Verify original message appears in center channel
    const postList = channelsPage.page.locator('#postListContent, #virtualizedPostListContent');
    await expect(postList.locator(`text=${originalMessage}`).first()).toBeVisible({timeout: 10000});

    // # Click reply button on the message
    const post = await channelsPage.centerView.getPostById(originalPost.id);
    await post.reply();

    // * Verify RHS (Right Hand Sidebar) opens
    await channelsPage.sidebarRight.toBeVisible();

    // * Verify original message appears at top of RHS
    await expect(channelsPage.sidebarRight.container.getByText(originalMessage)).toBeVisible();

    // # Type reply in RHS
    const replyMessage = `Reply to message at ${Date.now()}`;
    await channelsPage.sidebarRight.postCreate.postMessage(replyMessage);

    // * Verify reply appears in RHS
    await expect(channelsPage.sidebarRight.container.getByText(replyMessage).first()).toBeVisible({timeout: 10000});

    // * Verify thread count is updated in center channel (reply doesn't appear directly in center, but thread count updates)
    const threadPost = await channelsPage.centerView.getPostById(originalPost.id);
    await expect(threadPost.container.getByText('1 reply')).toBeVisible({timeout: 10000});
});
