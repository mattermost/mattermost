// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify a typed draft on one channel persists, restores after switching away through the sidebar and back,
 * and posts only to the origin channel.
 */
test('typed draft stays on the origin channel after switching away and back', {tag: '@messaging'}, async ({pw}) => {
    const {team, user, userClient, offTopic, townSquare} = await pw.initSetup();
    const lastPost = async (channelId: string) => {
        const posts = await userClient.getPosts(channelId);
        return posts.posts[posts.order[0]];
    };

    const {app} = await pw.testBrowser.login(user);
    await app.channelsPage.goto({team, channel: offTopic});
    await expect(app.center.postList.locator).toBeVisible();
    const composer = app.center.postCreate;

    const originDraft = `origin-draft-${pw.random.id()}`;
    const destinationMessage = `town-square-${pw.random.id()}`;

    // # Type a draft in Off-Topic and do not send it
    await composer.message.container.fill(originDraft);

    // # Switch to Town Square via the sidebar
    await app.lhs.channelList.channel(townSquare).container.click();
    await expect(app.channelHeader.openMenuButton).toContainText(townSquare.display_name);
    await expect(app.channelHeader.openMenuButton).toContainText('Town Square');

    // * The destination composer doesn't inherit the origin draft
    await expect(composer.message).toHaveValue('');

    // * The origin draft was kept: Off-Topic's row shows the draft pencil, and the Drafts link appears
    // (the pencil hides while its row is hovered, and the pointer is still over the sidebar after the click)
    await composer.message.container.hover();
    await expect(app.lhs.channelList.channel(offTopic).draftText.locator).toBeVisible();
    await expect(app.lhs.drafts).toBeVisible();

    // # Send a different message from Town Square
    await composer.message.container.fill(destinationMessage);
    await composer.sendButton.click();

    // * Town Square shows the destination message
    await expect.poll(async () => (await lastPost(townSquare.id)).message).toBe(destinationMessage);
    const sent = await lastPost(townSquare.id);
    await expect(app.center.postList.post(sent).message.container.locator).toHaveText(destinationMessage);

    // # Return to Off-Topic
    await app.lhs.channelList.channel(offTopic).container.click();
    await expect(app.channelHeader.openMenuButton).toContainText(offTopic.display_name);
    await expect(app.channelHeader.openMenuButton).toContainText('Off-Topic');

    // * The origin draft is back in the composer; send it
    await expect(composer.message).toHaveValue(originDraft);
    await composer.sendButton.click();

    // * Off-Topic shows the origin draft as a post, and Town Square's last post is still the destination message
    await expect.poll(async () => (await lastPost(offTopic.id)).message).toBe(originDraft);
    const restored = await lastPost(offTopic.id);
    await expect(app.center.postList.post(restored).message.container.locator).toHaveText(originDraft);
    expect((await lastPost(townSquare.id)).id).toBe(sent.id);
});
