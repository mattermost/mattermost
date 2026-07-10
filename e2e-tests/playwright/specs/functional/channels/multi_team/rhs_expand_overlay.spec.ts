// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify that the right-hand-side reply panel can be expanded to overlay the center channel and collapsed back while staying open.
 */
test('MM-T440 expands and collapses the RHS reply panel', {tag: '@multi_team'}, async ({pw}) => {
    // # Create and log in as a test user
    const {user, team} = await pw.initSetup();
    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, 'town-square');
    await channelsPage.toBeVisible();

    // # Post a message and open its thread in the RHS
    await channelsPage.postMessage(`rhs expand ${pw.random.id()}`);
    const post = await channelsPage.getLastPost();
    await post.reply();
    await channelsPage.sidebarRight.toBeVisible();

    // * Verify the RHS starts collapsed with an expand control
    await expect(channelsPage.sidebarRight.expandButton).toBeVisible();

    // # Expand the RHS
    await channelsPage.sidebarRight.expand();

    // * Verify the RHS is expanded (a collapse control is now shown)
    await expect(channelsPage.sidebarRight.collapseButton).toBeVisible();

    // # Collapse the RHS again
    await channelsPage.sidebarRight.collapse();

    // * Verify the RHS collapses but stays open, and the center channel is visible again
    await expect(channelsPage.sidebarRight.expandButton).toBeVisible();
    await channelsPage.sidebarRight.toBeVisible();
    await expect(channelsPage.centerView.postCreate.input).toBeVisible();
});
