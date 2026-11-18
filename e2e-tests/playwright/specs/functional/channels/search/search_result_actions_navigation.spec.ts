// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test, type App} from '@mattermost/playwright-lib';

/** Searches from the global header for the term. */
async function searchFor(app: App, term: string) {
    await app.globalHeader.search.openButton.clickTo(app.searchBox.inputSearchbox);
    await app.searchBox.inputSearchbox.fill(term);
    await app.searchBox.inputSearchbox.press('Enter');
    await expect(app.globalHeader.search.openButton).toContainText(term);
}

/**
 * @objective Verify that a full username containing '-' or '_' is shown as a mention link in the mentioned user's search results.
 */
test('MM-T348 shows a full special-character username as a link in search results', {tag: '@search'}, async ({pw}) => {
    // # Create a user whose username contains '-' and '_', plus a user who mentions them
    const {team, adminClient, userClient, townSquare} = await pw.initSetup();
    const [specialUser] = await adminClient.createUsers(team.id, 1, 'test-user_');
    await adminClient.addToChannel(specialUser.id, townSquare.id);

    // # The first user posts a message mentioning the special-character username
    const token = `mention${pw.random.id()}`;
    const post = await userClient.createPost({channel_id: townSquare.id, message: `@${specialUser.username} ${token}`});

    // # Log in as the mentioned user and open Recent Mentions
    const {app} = await pw.testBrowser.login(specialUser);
    await app.channelsPage.goto({team, channel: townSquare});
    await app.globalHeader.recentMentionsButton.click();

    // * Verify the mention shows the full username as a mention of that user (the mention keyed by the user's id,
    // inside its profile popover's button)
    const result = app.search.results.post(post);
    await expect(result.message.container).toContainText(token);
    const mention = result.markdown.mention(specialUser);
    await expect(mention).toHaveText(`@${specialUser.username}`);
});

/**
 * @objective Verify that jumping from a search result opens a post that is not already displayed in the center channel.
 */
test('MM-T380 jumps from a search result to a post in another channel', {tag: '@search'}, async ({pw}) => {
    // # Create and log in as a test user, and create a channel with many posts
    const {user, team, adminClient, offTopic} = await pw.initSetup();
    const linkChannel = await adminClient.createPublicChannel(team.id, 'Link Test', 'link-test');
    await adminClient.addToChannel(user.id, linkChannel.id);

    // # Post a target message surrounded by many other messages so it is not initially loaded elsewhere
    const token = `asparagus${pw.random.id()}`;
    for (let i = 0; i < 4; i++) {
        await adminClient.createPost({channel_id: linkChannel.id, message: `RF Random Post before ${i}`});
    }
    const target = await adminClient.createPost({channel_id: linkChannel.id, message: token});
    for (let i = 0; i < 8; i++) {
        await adminClient.createPost({channel_id: linkChannel.id, message: `RF Random Post after ${i}`});
    }
    const {app, page} = await pw.testBrowser.login(user);
    await app.channelsPage.goto({team, channel: offTopic});

    // # Search for the target message from a different channel
    await searchFor(app, token);
    const result = app.search.results.post(target);
    await expect(result.message.container).toHaveText(token);

    // # Jump to the post from the search results
    await result.container.hover();
    await result.menu.jumpLink.click();

    // * Verify navigation to the target channel and that the target post is displayed in the center
    await expect.poll(() => page.url(), {timeout: pw.duration.ten_sec}).toContain(`/channels/${linkChannel.name}`);
    await expect(app.center.postList.post(target).message.container).toHaveText(token);
});

/**
 * @objective Verify that deleting a parent post from the search results removes both the post and its reply.
 */
test('MM-T381 deletes a parent post from the search results', {tag: '@search'}, async ({pw}) => {
    // # Create a channel with a post and a reply to it
    const {user, team, adminClient, userClient} = await pw.initSetup();
    const channel = await adminClient.createPublicChannel(team.id, 'Delete Parent', 'delete-parent');
    await adminClient.addToChannel(user.id, channel.id);
    const parentToken = `parentpost${pw.random.id()}`;
    const replyToken = `replypost${pw.random.id()}`;
    const parent = await userClient.createPost({channel_id: channel.id, message: parentToken});
    const reply = await userClient.createPost({channel_id: channel.id, root_id: parent.id, message: replyToken});

    const {app} = await pw.testBrowser.login(user);
    await app.channelsPage.goto({team, channel});
    const results = app.search.results;

    // * Verify both the parent post and its reply are searchable before deletion
    await searchFor(app, replyToken);
    await expect(results.post(reply).message.container).toHaveText(replyToken);
    await searchFor(app, parentToken);
    const parentResult = results.post(parent);
    await expect(parentResult.message.container).toHaveText(parentToken);

    // # Delete the parent post from the search result
    await parentResult.container.hover();
    await parentResult.menu.dotMenuButton.clickTo(app.postDotMenu);
    const deleteModal = await app.postDotMenu.deleteMenuItem.clickTo(app.deletePostModal);
    await deleteModal.deleteButton.click();

    // * Verify the deleted parent post is removed from the open search results in real time
    await expect(parentResult).toHaveCount(0);

    // * Verify the reply was also removed (searching for it returns no results)
    await searchFor(app, replyToken);
    await expect(app.noResults.titleText).toBeVisible();
    await expect(results.post(reply)).toHaveCount(0);
});
