// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test} from '@e2e-support/test_fixture';

test('should be able too edit post message', async ({pw, pages}) => {
test.setTimeout(120000);

    const originalMessage = "Lorem ipsum dolor sit amet, consectetur adipiscing elit";

    const {user} = await pw.initSetup();
    const {page} = await pw.testBrowser.login(user);
    const channelPage = new pages.ChannelsPage(page);

    // await setupChannelPage(channelPage, draftMessage);
    await channelPage.goto();
    await channelPage.toBeVisible();
    await channelPage.centerView.postCreate.postMessage(originalMessage);

    const post = await channelPage.centerView.getLastPost();
    await post.toBeVisible();
    await post.hover();
    await post.postMenu.toBeVisible();

    // open the dot menu
    await post.postMenu.dotMenuButton.click();
    await channelPage.postDotMenu.toBeVisible();
    await channelPage.postDotMenu.editMenuItem.click();
    await channelPage.centerView.postEdit.toBeVisible();
    await channelPage.centerView.postEdit.writeMessage("Edited message");
    await channelPage.centerView.postEdit.sendMessage();

    const updatedPost = await channelPage.centerView.getLastPost();
    await updatedPost.toBeVisible();
    await updatedPost.toContainText("Edited message");
});
