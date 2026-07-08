// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify that a direct message can be opened from a user's profile popover on their post.
 */
test('MM-T455 opens a direct message from a profile popover', {tag: '@direct_messages'}, async ({pw}) => {
    // # Create the test user plus another user who posts in a shared channel
    const {user, team, adminClient} = await pw.initSetup();
    const [author] = await adminClient.createUsers(team.id, 1, 'author');
    const offTopic = await adminClient.getChannelByName(team.id, 'off-topic');
    await adminClient.addToChannel(author.id, offTopic.id);

    const token = `popover dm ${pw.random.id()}`;
    const {client: authorClient} = await pw.makeClient(author);
    await authorClient.createPost({channel_id: offTopic.id, message: token});

    const {channelsPage, page} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, 'off-topic');
    await channelsPage.toBeVisible();

    // # Open the author's profile popover from their post and click Message
    const post = await channelsPage.getLastPost();
    const popover = await channelsPage.openProfilePopover(post);
    await popover.message();

    // * Verify a direct message channel with the author is opened
    await expect.poll(() => page.url(), {timeout: pw.duration.ten_sec}).toContain(`/messages/@${author.username}`);
    await channelsPage.centerView.header.toHaveTitle(author.username);

    // # Post a message in the direct message channel
    const dmMessage = `direct message ${pw.random.id()}`;
    await channelsPage.postMessage(dmMessage);

    // * Verify the direct message is posted
    const lastPost = await channelsPage.getLastPost();
    await lastPost.toContainText(dmMessage);
});
