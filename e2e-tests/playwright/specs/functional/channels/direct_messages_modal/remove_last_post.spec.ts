// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Api, expect, generated, settle, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify deleting the last post in a direct message keeps the user in that conversation.
 */
test('MM-T218 removes the last post without leaving the direct message', {tag: '@direct_messages'}, async ({pw}) => {
    const {adminClient, team, user} = await pw.initSetup();
    const [otherUser] = await adminClient.createUsers(team.id, 1, 'dm-user');
    await adminClient.createDirectChannel([user.id, otherUser.id]);
    const dm = {team, path: 'messages', channel: `@${otherUser.username}`} as const;

    // # Log in and open the direct message with the other user
    const {app, page} = await pw.testBrowser.login(user);
    await app.channelsPage.goto(dm);

    // # Post a message; the create request returns the post
    const composer = app.center.postCreate;
    await composer.message.container.fill('Test');
    const created = await settle(composer.sendButton, {wait: Api.CreatePost}).click();

    // # Delete it from its post menu
    const post = app.center.postList.post(created);
    await post.locator.hover();
    await post.menu.dotMenuButton.clickTo(app.postDotMenu);
    const confirm = await app.postDotMenu.deleteMenuItem.clickTo(app.deletePostModal);
    await settle(confirm.deleteButton, {wait: Api.DeletePost}).click();

    // * The post is gone and the direct-message route is still open
    await expect(post).not.toBeVisible();
    await expect(page).toHavePath(generated.ChannelsPage.path(dm));
});
