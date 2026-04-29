// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {CollapsedThreads} from '@mattermost/types/config';

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify that the entire thread appears in the RHS and is scrollable
 *
 * @precondition
 * Test requires creating a thread with 100+ replies and 40+ unrelated channel messages
 */
test('MM-T3293 The entire thread appears in the RHS (scrollable)', {tag: ['@messaging']}, async ({pw}) => {
    test.setTimeout(120000);
    const NUMBER_OF_REPLIES = 100;
    const NUMBER_OF_MAIN_THREAD_MESSAGES = 40;

    // # Initialize setup and create test users
    const {team, user: mainUser, userClient} = await pw.initSetup();

    // # Update server config to disable collapsed threads
    const {adminClient} = await pw.getAdminClient();
    await adminClient.patchConfig({ServiceSettings: {CollapsedThreads: CollapsedThreads.DISABLED}});

    const otherUser = await pw.random.user('other');
    const createdOtherUser = await adminClient.createUser(otherUser, '', '');
    otherUser.id = createdOtherUser.id;

    // # Add the other user to the team
    await adminClient.addToTeam(team.id, otherUser.id);

    // # Get the town-square channel
    const channels = await userClient.getMyChannels(team.id);
    const townSquare = channels.find((channel) => channel.name === 'town-square');
    if (!townSquare) {
        throw new Error('Town Square channel not found');
    }

    // # Create a thread with several replies to make it scrollable in RHS
    const firstPost = await userClient.createPost({
        channel_id: townSquare.id,
        message: 'First message',
        user_id: mainUser.id,
    });

    // # Create multiple replies to the first post
    const replies = Array.from({length: NUMBER_OF_REPLIES}, (_, i) => `Reply number ${i + 1}`);
    for (let i = 0; i < replies.length; i += 10) {
        const batch = replies.slice(i, i + 10);
        await Promise.all(
            batch.map((message) =>
                userClient.createPost({
                    channel_id: townSquare.id,
                    message,
                    user_id: mainUser.id,
                    root_id: firstPost.id,
                }),
            ),
        );
    }

    // # Create enough posts from another user (not related to the thread) to not load on first view
    const mainMessages = Array.from({length: NUMBER_OF_MAIN_THREAD_MESSAGES}, (_, i) => `Other message ${i + 1}`);
    for (let i = 0; i < mainMessages.length; i += 10) {
        const batch = mainMessages.slice(i, i + 10);
        await Promise.all(
            batch.map((message) =>
                adminClient.createPost({
                    channel_id: townSquare.id,
                    message,
                    user_id: otherUser.id,
                }),
            ),
        );
    }

    // # Reply on original thread with a last reply
    const lastReplyMessage = 'Last Reply';
    const lastReply = await userClient.createPost({
        channel_id: townSquare.id,
        message: lastReplyMessage,
        user_id: mainUser.id,
        root_id: firstPost.id,
    });

    // # Load the channel as main user
    const {channelsPage} = await pw.testBrowser.login(mainUser);
    await channelsPage.goto(team.name, 'town-square');
    await channelsPage.toBeVisible();

    // # Click reply to last post to open thread on RHS
    const postWithReply = await channelsPage.centerView.getPostById(lastReply.id);
    await postWithReply.reply();

    // * Verify that the RHS is visible
    await channelsPage.sidebarRight.toBeVisible();

    // * Verify that the last reply appears in the RHS
    await expect(channelsPage.sidebarRight.container.getByText(lastReplyMessage)).toBeVisible();

    // # Scroll the RHS to the top to verify older replies are loaded and the first post is visible
    const rhsScrollArea = channelsPage.sidebarRight.container.locator('.post-list__dynamic--RHS');
    await rhsScrollArea.evaluate((el: HTMLElement) => el.scrollTo({top: 0, behavior: 'instant'}));

    // * Verify that the first post message is visible after scrolling
    await expect(rhsScrollArea.getByText('First message')).toBeVisible();

    // # Scroll the RHS to the bottom to verify the last reply remains visible
    await rhsScrollArea.evaluate((el: HTMLElement) => el.scrollTo({top: el.scrollHeight, behavior: 'instant'}));
    await expect(rhsScrollArea.getByText(lastReplyMessage)).toBeVisible();
});
