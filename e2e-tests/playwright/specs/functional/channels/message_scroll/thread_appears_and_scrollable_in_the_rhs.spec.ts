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
    await userClient.createPost({
        channel_id: townSquare.id,
        message: lastReplyMessage,
        user_id: mainUser.id,
        root_id: firstPost.id,
    });

    // # Load the channel as main user
    const {page, channelsPage} = await pw.testBrowser.login(mainUser);
    await channelsPage.goto(team.name, 'town-square');
    await channelsPage.toBeVisible();

    // # Open thread via "Last Reply" — the root post (First message) is buried 140+ posts
    // above the viewport and never rendered by the virtual list, so getPostById would time out.
    // "Last Reply" is always the last visible post; clicking reply on it opens the same thread.
    const lastPost = await channelsPage.centerView.getLastPost();
    await lastPost.reply();

    // * Verify that the RHS is visible
    await channelsPage.sidebarRight.toBeVisible();

    // * Verify that the last reply appears in the RHS
    const rhsContainer = channelsPage.sidebarRight.container;
    await expect(rhsContainer.getByText(lastReplyMessage)).toBeVisible();

    // # Hover over the RHS so mouse-wheel events scroll it, then iterate through messages
    // from the end, scrolling up to load previous messages.
    // We only assert on a sparse sample (every 10th reply) to keep the test fast while still
    // proving the virtualized thread list is scrollable end-to-end.
    // scrollIntoViewIfNeeded cannot be used here because older replies are not in the DOM
    // until the virtual list renders them after an upward scroll.
    await rhsContainer.hover();
    for (let i = replies.length - 1; i >= 0; i -= 10) {
        const replyText = replies[i];
        await expect
            .poll(
                async () => {
                    const el = rhsContainer.getByText(replyText, {exact: true});
                    if ((await el.count()) > 0 && (await el.first().isVisible())) {
                        return true;
                    }
                    // Element not yet in the DOM — scroll up to trigger virtual rendering.
                    await page.mouse.wheel(0, -400);
                    return false;
                },
                {timeout: 20000, intervals: [300]},
            )
            .toBeTruthy();
    }

    // * Verify that the first post message is visible after scrolling through the thread
    await expect
        .poll(
            async () => {
                const el = rhsContainer.getByText('First message', {exact: true});
                if ((await el.count()) > 0 && (await el.first().isVisible())) {
                    return true;
                }
                await page.mouse.wheel(0, -400);
                return false;
            },
            {timeout: 20000, intervals: [300]},
        )
        .toBeTruthy();
});
