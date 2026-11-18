// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Api, expect, settle, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify a message in a private channel can only be forwarded to that channel, and that
 * forwarding it with a comment posts the comment there.
 */
test('forwards a private-channel message with a comment to the same channel', {tag: '@channels'}, async ({pw}) => {
    const {adminClient, team, user, userClient} = await pw.initSetup();
    const channel = await adminClient.createPrivateChannel(team.id, `Private ${pw.random.id()}`);
    await adminClient.addToChannel(user.id, channel.id);
    const original = await userClient.createPost({channel_id: channel.id, message: `original ${pw.random.id()}`});

    // # Log in and open the private channel
    const {app} = await pw.testBrowser.login(user);
    await app.channelsPage.goto({team, channel});

    // # Open Forward from the post's menu
    const post = app.center.postList.post(original);
    await post.container.hover();
    await post.menu.dotMenuButton.clickTo(app.postDotMenu);
    const dotMenu = app.postDotMenu;
    const modal = await dotMenu.forwardMenuItem.clickTo(app.forwardPostModal);

    // * The modal says the message can only go to this channel, and offers no channel picker
    await expect(modal.notification.text).toContainText(
        `This message is from a private channel and can only be shared with ~${channel.display_name}`,
    );
    await expect(modal.channelSelectCombobox).toHaveCount(0);

    // # Add a comment and forward
    const comment = `comment ${pw.random.id()}`;
    await modal.comment.container.fill(comment);
    const forwarded = await settle(modal.confirmButton, {wait: Api.CreatePost}).click();

    // * The modal closes and the channel shows the forwarded post with the comment
    await expect(modal).toHaveCount(0);
    await expect(app.center.postList.post(forwarded)).toContainText(comment);
});
