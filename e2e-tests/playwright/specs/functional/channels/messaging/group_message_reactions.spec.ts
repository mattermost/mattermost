// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify a reaction can be added to a group message post and its action visibility adapts between desktop and mobile layouts.
 */
test('MM-T471 add a reaction to a message in a GM', {tag: '@messaging'}, async ({pw}) => {
    const {adminClient, team, user, userClient} = await pw.initSetup();
    const members = await adminClient.createUsers(team.id, 2, 'gm-reaction');
    const groupChannel = await userClient.createGroupChannel([user.id, ...members.map((member) => member.id)]);
    const post = await userClient.createPost({channel_id: groupChannel.id, message: 'This is a post'});

    // # Open the group message
    const {app, page} = await pw.testBrowser.login(user);
    await app.channelsPage.goto({team, path: 'messages', channel: groupChannel});
    const item = app.center.postList.post(post);
    // the "+" beside the post's reactions (the post menu has its own)
    const addReaction = item.reactions.addButton;

    // # Open the post's reaction picker and choose slightly frowning face
    await item.container.hover();
    await item.menu.addReactionButton.clickTo(app.emojiPicker.searchTextbox);
    await app.emojiPicker.searchTextbox.fill('slightly_frowning');
    await app.emojiPicker.systemEmoji('slightly_frowning_face').click();

    // * The reaction shows with a count of one, and the server has it
    await expect(item.reactions.reaction(0)).toContainText('1');
    await expect
        .poll(async () => (await userClient.getReactionsForPost(post.id)).map((r) => r.emoji_name))
        .toEqual(['slightly_frowning_face']);

    // # Click the channel intro, then the message box, to move focus off the post
    await app.channelHeader.openMenuButton.hover();
    await app.center.postCreate.message.container.focus();

    // * The Add Reaction action is hidden while the post isn't hovered
    await expect(addReaction).not.toBeVisible();

    // # Hover the post, then focus the message box again
    await item.container.hover();
    await expect(addReaction).toBeVisible();
    await app.center.postCreate.message.container.hover();
    await app.center.postCreate.message.container.focus();

    // * The Add Reaction action is hidden again
    await expect(addReaction).not.toBeVisible();

    // # Resize the window to a mobile viewport
    await page.setViewportSize({width: 375, height: 667});

    // * The Add Reaction action is visible in the mobile layout
    await expect(addReaction).toBeVisible();
});
