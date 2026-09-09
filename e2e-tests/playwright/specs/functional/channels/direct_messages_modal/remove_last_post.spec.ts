// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify deleting the last post in a direct message keeps the user in that conversation.
 */
test('MM-T218 removes the last post without leaving the direct message', {tag: '@direct_messages'}, async ({pw}) => {
    const {adminClient, team, user} = await pw.initSetup();
    const [otherUser] = await adminClient.createUsers(team.id, 1, 'dm-user');
    await adminClient.createDirectChannel([user.id, otherUser.id]);

    // # Log in and open the direct message with the other user
    const {channelsPage, page} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, `@${otherUser.username}`);
    await channelsPage.toBeVisible();

    // # Post a message, then delete it from its post menu
    await channelsPage.postMessage('Test');
    const post = await channelsPage.getLastPost();
    await post.hover();
    await post.postMenu.openDotMenu();
    await channelsPage.postDotMenu.deleteMenuItem.click();
    await channelsPage.deletePostModal.toBeVisible();
    await channelsPage.deletePostModal.confirm();

    // * Verify the post is gone and the direct-message route remains open
    await expect(post.container).not.toBeVisible();
    await expect(page).toHaveURL(`/${team.name}/messages/@${otherUser.username}`);
});
