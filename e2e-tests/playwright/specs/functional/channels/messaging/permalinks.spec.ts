// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify that clicking a post timestamp in the RHS or center channel highlights the post in the center channel.
 */
test('MM-T176 highlights the center post when its timestamp is clicked', {tag: '@messaging'}, async ({pw}) => {
    // # Create and log in as a test user
    const {user, team} = await pw.initSetup();
    const {channelsPage, page} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, 'town-square');
    await channelsPage.toBeVisible();

    // # Post a message and open its thread, then reply in the RHS
    await channelsPage.postMessage(`timestamp highlight ${pw.random.id()}`);
    const rootPost = await channelsPage.getLastPost();
    const rootId = await rootPost.getId();
    await rootPost.reply();
    await channelsPage.sidebarRight.toBeVisible();
    await channelsPage.sidebarRight.postMessage('Reply to test timestamp click');

    // # Click the root post timestamp in the RHS
    await page.locator(`#RHS_ROOT_time_${rootId}`).click();

    // * Verify the matching post is highlighted in the center channel
    const centerPost = await channelsPage.centerView.getPostById(rootId);
    await expect(centerPost.container).toHaveClass(/post--highlight/);

    // # Close the RHS and wait for the highlight to fade
    await channelsPage.sidebarRight.close();
    await expect(centerPost.container).not.toHaveClass(/post--highlight/);

    // # Click the same post timestamp in the center channel
    await page.locator(`#CENTER_time_${rootId}`).click();

    // * Verify the post is highlighted again in the center channel
    await expect(centerPost.container).toHaveClass(/post--highlight/);
});

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
