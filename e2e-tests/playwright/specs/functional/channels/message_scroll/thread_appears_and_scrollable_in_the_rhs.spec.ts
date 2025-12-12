// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {AdminConfig, CollapsedThreads} from '@mattermost/types/config';

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify that the entire thread appears in the RHS and is scrollable
 *
 * @precondition
 * Test requires creating a thread with 100+ replies and 40+ unrelated channel messages
 */
test('MM-T3293 The entire thread appears in the RHS (scrollable)', {tag: ['@messaging']}, async ({pw}) => {
    const NUMBER_OF_REPLIES = 100;
    const NUMBER_OF_MAIN_THREAD_MESSAGES = 40;

    // # Initialize setup and create test users
    const {team, user: mainUser, userClient} = await pw.initSetup();

    // # Update server config to disable collapsed threads
    const {adminClient} = await pw.getAdminClient();
    await adminClient.updateConfig(
        pw.mergeWithOnPremServerConfig({
            ServiceSettings: {CollapsedThreads: CollapsedThreads.DISABLED},
        } as Partial<AdminConfig>),
    );

    const otherUser = pw.random.user('other');
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
    const replies: string[] = [];
    for (let i = 1; i <= NUMBER_OF_REPLIES; i++) {
        const replyMessage = `Reply number ${i}`;
        await userClient.createPost({
            channel_id: townSquare.id,
            message: replyMessage,
            user_id: mainUser.id,
            root_id: firstPost.id,
        });
        replies.push(replyMessage);
    }

    // # Create enough posts from another user (not related to the thread) to not load on first view
    for (let i = 1; i <= NUMBER_OF_MAIN_THREAD_MESSAGES; i++) {
        await adminClient.createPost({
            channel_id: townSquare.id,
            message: `Other message ${i}`,
            user_id: otherUser.id,
        });
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

    // # Iterate through messages from the end, scrolling up to load previous messages
    const rhsContainer = channelsPage.sidebarRight.container;
    for (let i = replies.length - 1; i >= 0; i--) {
        const replyText = replies[i];
        const replyElement = rhsContainer.getByText(replyText, {exact: true});

        // # Scroll the reply into view
        await replyElement.scrollIntoViewIfNeeded();

        // * Verify the reply is visible
        await expect(replyElement).toBeVisible();
    }

    // * Verify that the first post message is visible after scrolling through all replies
    await expect(rhsContainer.getByText('First message')).toBeVisible();
});
