// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test, Api, settle} from '@mattermost/playwright-lib';

/**
 * @objective Verify a user can reply to a post from search results and see the reply in the opened thread.
 */
test('MM-T373 replies to a post from search results', {tag: '@search'}, async ({pw}) => {
    // # Create a uniquely searchable post and open its channel
    const {user, team, userClient, offTopic: channel} = await pw.initSetup();
    const message = `asparagus${pw.random.id()}`;
    const post = await userClient.createPost({channel_id: channel.id, message});

    const {app} = await pw.testBrowser.login(user);
    await app.channelsPage.goto({team, channel});

    // # Search for the post and open its thread from the result
    await app.globalHeader.search.openButton.clickTo(app.searchBox.inputSearchbox);
    await app.searchBox.inputSearchbox.fill(message);
    await app.searchBox.inputSearchbox.press('Enter');
    const result = app.search.results.post(post);
    await expect(result).toContainText(message);
    await result.container.hover();
    await result.menu.replyButton.click();
    await expect(app.rhs.postCreate.message.container).toBeVisible();

    // # Post a reply in the opened thread
    const comment = `Replying to asparagus ${pw.random.id()}`;
    await app.rhs.postCreate.message.container.fill(comment);
    await settle(app.rhs.postCreate.sendButton, {wait: Api.CreatePost}).click();

    // * The thread shows the original post first and the new reply after it
    await expect.poll(async () => (await app.rhs.thread.postList.keys()).length).toBe(2);
    const [rootId, replyId] = await app.rhs.thread.postList.keys();
    expect(rootId).toBe(post.id);
    await expect(app.rhs.thread.post({id: replyId}).message.container).toHaveText(comment);
});
