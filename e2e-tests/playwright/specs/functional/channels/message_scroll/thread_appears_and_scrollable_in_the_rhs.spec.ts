// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {CollapsedThreads} from '@mattermost/types/config';

import {expect, test, duration} from '@mattermost/playwright-lib';

/**
 * @objective Verify that the entire thread appears in the RHS and is scrollable
 *
 * @precondition
 * Test requires creating a thread with 100+ replies and 40+ unrelated channel messages
 */
test('MM-T3293 The entire thread appears in the RHS (scrollable)', {tag: ['@messaging']}, async ({pw}) => {
    test.setTimeout(duration.two_min);
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
    const replies: Array<{id: string; message: string}> = [];
    for (let i = 1; i <= NUMBER_OF_REPLIES; i++) {
        const replyMessage = `Reply number ${i}`;
        const reply = await userClient.createPost({
            channel_id: townSquare.id,
            message: replyMessage,
            user_id: mainUser.id,
            root_id: firstPost.id,
        });
        replies.push({id: reply.id, message: replyMessage});
    }

    // # Create enough posts from another user (not related to the thread) to not load on first view
    for (let i = 1; i <= NUMBER_OF_MAIN_THREAD_MESSAGES; i++) {
        await pw.postAs(otherUser, {
            channel_id: townSquare.id,
            message: `Other message ${i}`,
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
    const {app, page} = await pw.testBrowser.login(mainUser);
    await app.channelsPage.goto({team, channel: townSquare});

    // # Open thread via "Last Reply": the root post (First message) is buried 140+ posts above the viewport and
    // never rendered by the virtual list, but replying to the last reply opens the same thread.
    const centerLastReply = app.center.postList.post(lastReply);
    await centerLastReply.locator.hover();
    await centerLastReply.menu.replyButton.click();
    await expect(app.rhs.postCreate.message.container).toBeVisible();

    // * Verify that the last reply appears in the RHS
    const {thread} = app.rhs;
    await expect(thread.post(lastReply).message.container).toHaveText(lastReplyMessage);

    /** Scrolls the thread up until the post is rendered and visible (older replies aren't in the DOM until then). */
    const scrollUpTo = async (post: {id: string}) => {
        await expect(async () => {
            try {
                await expect(thread.post(post).container).toBeVisible({timeout: 1});
            } catch (error) {
                await page.mouse.wheel(0, -400);
                throw error;
            }
        }).toPass({timeout: duration.half_min, intervals: [300]});
    };

    // # Hover over the thread so mouse-wheel events scroll it, then go through the replies from the end, scrolling
    // up to load previous messages. Only every 10th reply is checked, to keep the test fast while still proving the
    // virtualized thread list is scrollable end-to-end.
    await thread.scroller.hover();
    await expect.poll(() => thread.scroller.locator.evaluate((element) => element.matches(':hover'))).toBe(true);
    for (let i = replies.length - 1; i >= 0; i -= 10) {
        await scrollUpTo(replies[i]);
        await expect(thread.post(replies[i]).message.container).toHaveText(replies[i].message);
    }

    // * Verify that the first post message is visible after scrolling through the thread
    await scrollUpTo(firstPost);
    await expect(thread.post(firstPost).message.container).toHaveText('First message');
});
