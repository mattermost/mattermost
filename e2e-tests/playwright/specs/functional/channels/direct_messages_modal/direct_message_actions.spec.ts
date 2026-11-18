// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Api, expect, settle, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify that mentioning a user inside a different pair of users' direct message does not notify the mentioned user.
 */
test('MM-T448 does not notify a user mentioned in a different DM', {tag: '@direct_messages'}, async ({pw}) => {
    // # Create the test user plus two more users on the team
    const {user, team, adminClient, userClient, townSquare} = await pw.initSetup();
    const [partner, mentioned] = await adminClient.createUsers(team.id, 2, 'dmuser');
    const token = `dmmention${pw.random.id()}`;
    // # As the test user, mention the third user in a DM with the partner, and mention them in Town Square too
    // (the Town Square mention shows Recent mentions works, so the missing DM mention means something)
    const dm = await userClient.createDirectChannel([user.id, partner.id]);
    const dmPost = await userClient.createPost({channel_id: dm.id, message: `@${mentioned.username} ${token}`});
    const channelPost = await userClient.createPost({
        channel_id: townSquare.id,
        message: `@${mentioned.username} in town square ${token}`,
    });

    // # Log in as the mentioned user and open Recent Mentions
    const {app} = await pw.testBrowser.login(mentioned);
    await app.channelsPage.goto({team, channel: townSquare});
    await app.globalHeader.recentMentionsButton.click();

    // * Verify the mentioned user did not receive the mention from the other users' DM
    await expect(app.search.results.post(channelPost).message.container.locator).toContainText(token);
    await expect(app.search.results.post(dmPost).locator).toHaveCount(0);
});

/**
 * @objective Verify that deleting a parent post from a direct message reply thread removes the post, its reply, and closes the thread.
 */
test(
    'MM-T454 deletes a parent post in a direct message from the reply thread',
    {tag: '@direct_messages'},
    async ({pw}) => {
        // # Create the test user plus another user to direct message, and a parent post with a reply in their DM
        const {user, team, adminClient, userClient} = await pw.initSetup();
        const [otherUser] = await adminClient.createUsers(team.id, 1, 'other');
        const dm = await userClient.createDirectChannel([user.id, otherUser.id]);
        const parent = await userClient.createPost({
            channel_id: dm.id,
            message: `This is the parent post ${pw.random.id()}`,
        });
        const reply = await userClient.createPost({
            channel_id: dm.id,
            root_id: parent.id,
            message: `This is a reply ${pw.random.id()}`,
        });

        // # Open the direct message and the parent's reply thread
        const {app} = await pw.testBrowser.login(user);
        await app.channelsPage.goto({team, path: 'messages', channel: `@${otherUser.username}`});
        const centerParent = app.center.postList.post(parent);
        await centerParent.locator.hover();
        await centerParent.menu.replyButton.click();
        await expect(app.rhs.postCreate.message.container).toBeVisible();
        await expect(app.rhs.thread.post(reply).message.container.locator).toHaveText(reply.message);

        // # Delete the parent post (which has a reply) while its thread is open.
        // The parent is deleted from the center post menu, which is equivalent to and more
        // stable than the virtualized RHS root menu; the resulting behavior is identical.
        await centerParent.locator.hover();
        await centerParent.menu.dotMenuButton.clickTo(app.postDotMenu);
        const deleteModal = await app.postDotMenu.deleteMenuItem.clickTo(app.deletePostModal);
        await deleteModal.deleteButton.click();

        // * Verify the reply thread closes and the parent post is gone from the center channel
        await expect(app.rhs.thread.post(reply).locator).toHaveCount(0);
        await expect(app.rhs.postCreate.message).not.toBeVisible();
        await expect(centerParent.locator).toHaveCount(0);
    },
);

/**
 * @objective Verify that a direct message can be opened from a user's profile popover on their post.
 */
test('MM-T455 opens a direct message from a profile popover', {tag: '@direct_messages'}, async ({pw}) => {
    // # Create the test user plus another user who posts in a shared channel
    const {user, team, adminClient, offTopic} = await pw.initSetup();
    const [author] = await adminClient.createUsers(team.id, 1, 'author');
    await adminClient.addToChannel(author.id, offTopic.id);
    const token = `popover dm ${pw.random.id()}`;
    const {client: authorClient} = await pw.makeClient(author);
    const post = await authorClient.createPost({channel_id: offTopic.id, message: token});

    const {app, page} = await pw.testBrowser.login(user);
    await app.channelsPage.goto({team, channel: offTopic});

    // # Open the author's profile popover from their post and click Message
    // the avatar is an image inside the profile popover's button: clicking it opens the popover (an image has no click verb)
    await app.center.postList.post(post).avatar.container.click();
    await expect(app.profilePopover).toBeVisible();
    await app.profilePopover.actions.messageButton.click();

    // * Verify a direct message channel with the author is opened
    await expect.poll(() => page.url(), {timeout: pw.duration.ten_sec}).toContain(`/messages/@${author.username}`);
    await expect(app.channelHeader.openMenuButton).toContainText(author.username);

    // # Post a message in the direct message channel
    const dmMessage = `direct message ${pw.random.id()}`;
    await app.center.postCreate.message.container.fill(dmMessage);
    const sent = await settle(app.center.postCreate.sendButton, {wait: Api.CreatePost}).click();

    // * Verify the direct message is posted
    await expect(app.center.postList.post(sent).message.container.locator).toHaveText(dmMessage);
});
