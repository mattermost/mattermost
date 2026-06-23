// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

import {
    createPost,
    createPublicChannel,
    createUsers,
    expectSidebarRead,
    expectSidebarUnread,
    expectUnreadSeparator,
    goToSidebarItem,
    markPostAsUnreadFromMenu,
} from '../rfqa_helpers';

/**
 * @objective Verify a public channel post can be marked unread from the post menu.
 */
test('MM-T246 Mark Post as Unread', {tag: '@rfqa'}, async ({pw}) => {
    const {adminClient, team, user} = await pw.initSetup();
    const [author] = await createUsers(pw, adminClient, team, 1, 'rfqa-unread-author');
    const channelA = await createPublicChannel(pw, adminClient, team, 'RFQA Unread A');
    const channelB = await createPublicChannel(pw, adminClient, team, 'RFQA Unread B');
    await adminClient.addToChannel(user.id, channelA.id);
    await adminClient.addToChannel(user.id, channelB.id);
    await adminClient.addToChannel(author.id, channelA.id);

    // # Create messages and mark the last one as unread
    await createPost(adminClient, author, channelA, 'hello from current user: 1');
    const unreadPost = await createPost(adminClient, author, channelA, 'hello from current user: 4');
    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channelA.name);
    await channelsPage.toBeVisible();
    await markPostAsUnreadFromMenu(channelsPage, unreadPost.id);

    // * Verify the unread separator appears at the selected post
    await expectUnreadSeparator(channelsPage, 'hello from current user: 4');

    // # Switch away and back to the marked channel
    await channelsPage.sidebarLeft.goToItem(channelB.name);

    // * Verify the original channel is unread while away
    await expectSidebarUnread(channelsPage, channelA.name);
    await channelsPage.sidebarLeft.goToItem(channelA.name);

    // * Verify opening the channel marks it read while preserving the unread separator
    await expectSidebarRead(channelsPage, channelA.name);
    await expectUnreadSeparator(channelsPage, 'hello from current user: 4');
});

/**
 * @objective Verify a direct-message post can be marked unread and clears when revisited.
 */
test('MM-T248 Mark Direct Message post as Unread', {tag: '@rfqa'}, async ({pw}) => {
    const {adminClient, team, user} = await pw.initSetup();
    const [otherUser] = await createUsers(pw, adminClient, team, 1, 'rfqa-dm-unread');
    const dmChannel = await adminClient.createDirectChannel([user.id, otherUser.id]);
    const unreadPost = await createPost(adminClient, otherUser, dmChannel, 'Unread from here');
    await createPost(adminClient, otherUser, dmChannel, 'Unread after here');

    // # Open the DM channel and mark a post as unread
    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, `@${otherUser.username}`);
    await channelsPage.toBeVisible();
    await markPostAsUnreadFromMenu(channelsPage, unreadPost.id);

    // * Verify unread state appears for the DM
    await expectUnreadSeparator(channelsPage, 'Unread from here');
    await expectSidebarUnread(channelsPage, otherUser.username);

    // # Leave and return to the DM channel
    await goToSidebarItem(channelsPage, 'off-topic');
    await expectSidebarUnread(channelsPage, otherUser.username);
    await goToSidebarItem(channelsPage, otherUser.username);

    // * Verify the DM is marked read after revisiting
    await expectSidebarRead(channelsPage, otherUser.username);
});

/**
 * @objective Verify a thread post can be marked unread from the RHS without adding a separator inside the RHS.
 */
test('MM-T250 Mark as unread in the RHS', {tag: '@rfqa'}, async ({pw}) => {
    const {adminClient, team, user} = await pw.initSetup();
    const [author] = await createUsers(pw, adminClient, team, 1, 'rfqa-rhs-unread');
    const channelA = await createPublicChannel(pw, adminClient, team, 'RFQA RHS Unread A');
    const channelB = await createPublicChannel(pw, adminClient, team, 'RFQA RHS Unread B');
    await adminClient.addToChannel(user.id, channelA.id);
    await adminClient.addToChannel(user.id, channelB.id);
    await adminClient.addToChannel(author.id, channelA.id);

    // # Create a thread and mark the root post unread from the RHS
    const root = await createPost(adminClient, author, channelA, 'post1');
    await createPost(adminClient, author, channelA, 'post2', root.id);
    const {channelsPage, page} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channelA.name);
    await channelsPage.toBeVisible();
    await (await channelsPage.centerView.getPostById(root.id)).reply();
    await adminClient.markPostAsUnread(user.id, root.id);
    await page.reload();
    if (!(await channelsPage.sidebarRight.container.isVisible().catch(() => false))) {
        await channelsPage.goto(team.name, channelA.name);
        await (await channelsPage.centerView.getPostById(root.id)).reply();
    }

    // * Verify the center channel shows the unread separator and RHS does not
    await expectUnreadSeparator(channelsPage, 'post1');
    await expect(channelsPage.sidebarRight.container.locator('.NotificationSeparator')).toHaveCount(0);

    // # Switch away and back
    await channelsPage.sidebarLeft.goToItem(channelB.name);
    await channelsPage.sidebarLeft.goToItem(channelA.name);

    // * Verify the channel returns to read state
    await expectSidebarRead(channelsPage, channelA.name);
});
