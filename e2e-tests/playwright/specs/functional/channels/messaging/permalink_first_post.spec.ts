// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify that following a permalink to the first post in a channel loads the channel start without an endless loading indicator above it.
 */
test('MM-T3308 follows a permalink to the first post without endless loading', {tag: '@messaging'}, async ({pw}) => {
    const messageCount = 10;
    const base = `permalink-${pw.random.id()}`;

    // # Create and log in as a test user, and create a private channel with several posts
    const {user, team, adminClient} = await pw.initSetup();
    const privateChannel = await adminClient.createPrivateChannel(team.id, 'Permalink First');
    await adminClient.addToChannel(user.id, privateChannel.id);

    let firstPostId = '';
    for (let i = 1; i <= messageCount; i++) {
        const created = await adminClient.createPost({channel_id: privateChannel.id, message: `${base}-${i}`});
        if (i === 1) {
            firstPostId = created.id;
        }
    }

    const {channelsPage, page} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, 'off-topic');
    await channelsPage.toBeVisible();

    // # Post a permalink to the first (oldest) post into the public channel
    const permalink = `${new URL(page.url()).origin}/${team.name}/pl/${firstPostId}`;
    await channelsPage.postMessage(permalink);
    await channelsPage.centerView.waitUntilLastPostContains(permalink);

    // # Click the permalink in the posted message
    const permalinkPost = await channelsPage.getLastPost();
    await permalinkPost.body.getByRole('link', {name: permalink}).click();

    // * Verify navigation lands in the target private channel
    await expect
        .poll(() => page.url(), {timeout: pw.duration.ten_sec})
        .toContain(`/${team.name}/channels/${privateChannel.name}`);

    // * Verify the channel start intro is shown, proving the top loaded without an endless loading indicator
    await expect(page.getByText(`This is the start of ${privateChannel.display_name}`)).toBeVisible();

    // * Verify the most recent post is the last message that was created
    const lastPost = await channelsPage.getLastPost();
    await lastPost.toContainText(`${base}-${messageCount}`);
});
