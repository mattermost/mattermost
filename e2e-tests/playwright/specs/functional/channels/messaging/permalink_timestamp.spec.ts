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
