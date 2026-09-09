// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify a reaction can be added to a group message post and its action visibility adapts between desktop and mobile layouts.
 */
test('MM-T471 add a reaction to a message in a GM', {tag: '@messaging'}, async ({pw}) => {
    const {adminClient, team, user} = await pw.initSetup();
    const members = await adminClient.createUsers(team.id, 2, 'gm-reaction');
    const groupChannel = await adminClient.createGroupChannel([user.id, ...members.map((member) => member.id)]);

    // # Open the group message and post a message
    const {channelsPage, page} = await pw.testBrowser.login(user);
    await channelsPage.gotoMessage(team.name, groupChannel.name);
    await channelsPage.toBeVisible();
    await channelsPage.postMessage('This is a post');
    const post = await channelsPage.getLastPost();

    // # Open the post reaction picker and choose slightly frowning face
    await post.openReactionPicker();
    await channelsPage.reactionEmojiPicker.clickEmoji('slightly frowning face');

    // * Verify the reaction is visible with a count of one
    await post.toHaveReaction('slightly_frowning_face', 1);
    const {addReactionButton} = post;

    // # Click the channel intro, then focus the message input to clear post focus
    await channelsPage.centerView.channelIntro.click();
    await channelsPage.centerView.postCreate.input.click();

    // * Verify the Add Reaction action is hidden when the desktop post is not hovered
    await expect(addReactionButton).not.toBeVisible();

    // # Hover the post, then focus the message input again
    await post.hover();
    await expect(addReactionButton).toBeVisible();
    await channelsPage.centerView.postCreate.input.click();

    // * Verify the Add Reaction action is hidden again
    await expect(addReactionButton).not.toBeVisible();

    // # Resize the window to a mobile viewport
    await page.setViewportSize({width: 375, height: 667});

    // * Verify the Add Reaction action is visible in the mobile layout
    await expect(addReactionButton).toBeVisible();
});
