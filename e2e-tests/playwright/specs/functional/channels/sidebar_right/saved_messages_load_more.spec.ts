// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify Saved messages loads older saved messages as the user scrolls past the first page.
 */
test('MM-49216 loads more saved messages on scroll', async ({pw}) => {
    // # Create a user with more saved messages than fit on one page
    const {user, team, userClient} = await pw.initSetup();
    const townSquare = await userClient.getChannelByName(team.id, 'town-square');
    const prefix = `saved-${pw.random.id()}`;
    const total = 65;

    const postIds: string[] = [];
    for (let i = 0; i < total; i++) {
        const post = await userClient.createPost({channel_id: townSquare.id, message: `${prefix} ${i}`});
        postIds.push(post.id);
    }
    await userClient.savePreferences(
        user.id,
        postIds.map((id) => ({user_id: user.id, category: 'flagged_post', name: id, value: 'true'})),
    );

    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, 'town-square');
    await channelsPage.toBeVisible();

    // # Open Saved messages
    await channelsPage.globalHeader.openSavedMessages();
    await channelsPage.searchResultsPanel.toHaveHeading('Saved messages');

    const items = channelsPage.searchResultsPanel.getResultItems();
    const oldest = channelsPage.searchResultsPanel.getResultByText(`${prefix} 0`);

    // * Verify the newest saved message is listed
    await expect(channelsPage.searchResultsPanel.getResultByText(`${prefix} ${total - 1}`)).toBeVisible();

    // # Scroll to the bottom of the list until the oldest saved message loads
    await expect(async () => {
        await items.last().scrollIntoViewIfNeeded();
        await expect(oldest).toBeVisible({timeout: 1000});
    }).toPass();

    // * Verify every saved message is listed exactly once
    await expect(items).toHaveCount(total);
});
